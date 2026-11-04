// ============================================================
//  Cinc — sincronización entre dispositivos con Firebase
//  Con la sesión de Google iniciada, los datos se guardan también en
//  Firestore (usuarios/{uid}) y se reciben al momento en los demás
//  dispositivos. Sin sesión, la app funciona como siempre, solo en local.
// ============================================================

import { firebaseConfig } from './firebase-config.js';

const VERSION_FIREBASE = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}`;

// Usuario con el que este dispositivo ya sincroniza. Si no coincide, al
// iniciar sesión se pregunta qué notas usar (las de la cuenta o las de aquí).
const CLAVE_VINCULO = 'cinc-sync-usuario';

const dialogo = document.getElementById('dialogo-sync');
const botonSync = document.getElementById('boton-sync');

if (firebaseConfig) {
  iniciar().catch(error => {
    console.error(error);
    botonSync.textContent = 'Sin sincronizar';
  });
}

async function iniciar() {
  // Firebase se carga solo si está configurado (y si hay conexión)
  const [{ initializeApp }, autenticacion, firestore] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`)
  ]);
  const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
          getRedirectResult, signOut } = autenticacion;
  const { initializeFirestore, persistentLocalCache, doc, onSnapshot, setDoc } = firestore;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Caché local de Firestore: si no hay conexión, los cambios esperan y se suben al volver
  const bd = initializeFirestore(app, { localCache: persistentLocalCache() });

  let usuario = null;
  let dejarDeEscuchar = null;
  let ultimoJson = null;      // lo último subido o recibido, para no repetir
  let temporizador = null;

  botonSync.hidden = false;
  botonSync.addEventListener('click', () => {
    document.getElementById('error-sync').textContent = '';
    dialogo.showModal();
  });

  // ---------- Iniciar y cerrar sesión ----------

  document.getElementById('boton-entrar').addEventListener('click', async () => {
    const proveedor = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, proveedor);
    } catch (error) {
      // En algunos móviles (app instalada) las ventanas emergentes no funcionan
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
        await signInWithRedirect(auth, proveedor);
      } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        document.getElementById('error-sync').textContent = 'No se ha podido iniciar sesión. Vuelve a intentarlo.';
        console.error(error);
      }
    }
  });
  getRedirectResult(auth).catch(error => console.error(error));

  document.getElementById('boton-salir').addEventListener('click', async () => {
    // La próxima vez que se inicie sesión en este dispositivo se volverá a preguntar
    localStorage.removeItem(CLAVE_VINCULO);
    await signOut(auth);
  });

  onAuthStateChanged(auth, nuevo => {
    usuario = nuevo;
    if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
    ultimoJson = null;
    pintarEstado();
    if (usuario) escuchar();
  });

  // ---------- Recibir cambios de la nube ----------

  function referencia() {
    return doc(bd, 'usuarios', usuario.uid);
  }

  function escuchar() {
    let primera = true;
    dejarDeEscuchar = onSnapshot(referencia(), { includeMetadataChanges: true }, async foto => {
      pintarEstado(foto.metadata.hasPendingWrites ? 'subiendo' : (foto.metadata.fromCache ? 'sin-conexion' : 'al-dia'));
      if (foto.metadata.hasPendingWrites) return;   // es un cambio nuestro que aún se está subiendo

      const local = JSON.stringify(window.cinc.datosParaSubir());

      // La cuenta aún no tiene datos: se suben los de este dispositivo
      if (!foto.exists()) {
        if (primera && !foto.metadata.fromCache) {
          primera = false;
          localStorage.setItem(CLAVE_VINCULO, usuario.uid);
          await subir(true);
        }
        return;
      }

      const remoto = foto.data();
      if (primera) {
        primera = false;
        const vinculado = localStorage.getItem(CLAVE_VINCULO) === usuario.uid;
        // Primera vez en este dispositivo y las notas de aquí son distintas de las de la cuenta
        if (!vinculado && window.cinc.hayDatos() && remoto.json !== local) {
          const fecha = new Date(remoto.modificado).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
          const usarCuenta = confirm(
            `Tu cuenta ya tiene notas guardadas (último cambio: ${fecha}) y son distintas de las de este dispositivo.\n\n` +
            'Aceptar: usar las de la cuenta (las de aquí se guardan aparte como copia).\n' +
            'Cancelar: subir las de este dispositivo y sustituir las de la cuenta.'
          );
          localStorage.setItem(CLAVE_VINCULO, usuario.uid);
          if (!usarCuenta) { await subir(true); return; }
          localStorage.setItem('cinc-datos-antes-sync', localStorage.getItem('cinc-datos'));
        }
        localStorage.setItem(CLAVE_VINCULO, usuario.uid);
      }

      if (remoto.json === ultimoJson) return;
      ultimoJson = remoto.json;
      if (remoto.json !== local) {
        window.cinc.aplicarDatosRemotos(JSON.parse(remoto.json));
      }
    }, error => {
      console.error(error);
      pintarEstado('error');
    });
  }

  // ---------- Subir los cambios de este dispositivo ----------

  async function subir(forzar = false) {
    if (!usuario || localStorage.getItem(CLAVE_VINCULO) !== usuario.uid) return;
    const json = JSON.stringify(window.cinc.datosParaSubir());
    if (!forzar && json === ultimoJson) return;
    ultimoJson = json;
    try {
      await setDoc(referencia(), { json, modificado: Date.now() });
    } catch (error) {
      console.error(error);
      pintarEstado('error');
    }
  }

  // Cada vez que la app guarda, se sube (esperando un momento por si hay más cambios seguidos)
  window.addEventListener('cinc:guardado', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => subir(), 800);
  });

  // ---------- Estado en pantalla ----------

  function pintarEstado(estado) {
    document.getElementById('sync-fuera').hidden = Boolean(usuario);
    document.getElementById('sync-dentro').hidden = !usuario;
    if (!usuario) {
      botonSync.textContent = 'Sincronizar';
      return;
    }
    document.getElementById('sync-cuenta').textContent = usuario.email;
    const textos = {
      'al-dia': ['Sincronizado', 'Tus notas están al día en todos tus dispositivos.'],
      'subiendo': ['Sincronizando…', 'Subiendo los últimos cambios…'],
      'sin-conexion': ['Sin conexión', 'Sin conexión: los cambios se subirán solos cuando vuelva la conexión.'],
      'error': ['Error al sincronizar', 'No se ha podido sincronizar. Las notas siguen guardadas en este dispositivo.']
    };
    const [boton, detalle] = textos[estado] || ['Sincronizado', 'Conectando…'];
    botonSync.textContent = boton;
    document.getElementById('sync-estado').textContent = detalle;
  }
}
