"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // Keeps the user signed in across refreshes
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    setError("");
    if (!auth) {
      setError("Sign-in is not set up yet (Firebase keys missing).");
      return false;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return false;
      if (e.code === "auth/popup-blocked") setError("Popup was blocked by your browser. Allow popups and try again.");
      else if (e.code === "auth/unauthorized-domain")
        setError("This domain is not authorised in Firebase (Authentication → Settings → Authorized domains).");
      else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection and try again.");
      else setError("Sign-in failed. Please try again.");
      return false;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (auth) await signOut(auth);
  }, []);

  return { user, loading, error, setError, signIn, signOutUser };
}