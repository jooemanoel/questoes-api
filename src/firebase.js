// Acesso ao Firestore pelo SDK de administrador (firebase-admin).
//
// Ele se autentica com uma conta de serviço e só roda no servidor, ignorando as regras
// do Firestore. Assim as regras podem bloquear todo acesso direto do navegador, e só
// esta API (e a listas-api) leem e gravam no banco.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function conectar() {
  if (!getApps().length) {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      // Sem a chave nas variáveis, usa GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON local).
      credential: FIREBASE_PRIVATE_KEY
        ? cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            // Na Vercel e no .env as quebras de linha chegam como "\n" literal.
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          })
        : applicationDefault(),
    });
  }
  return getFirestore();
}

export const db = conectar();
