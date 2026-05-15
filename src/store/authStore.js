import { create } from 'zustand'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export const useAuthStore = create((set) => ({
  user: null,
  userData: null,
  loading: true,
  setUser: (user) => set({ user }),
  setUserData: (userData) => set({ userData }),
  setLoading: (loading) => set({ loading }),
  
  initializeAuth: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user })
        // Fetch user document from firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            set({ userData: userDoc.data() })
          } else {
            set({ userData: null })
          }
        } catch (error) {
          console.error("Error fetching user data", error)
          set({ userData: null })
        }
      } else {
        set({ user: null, userData: null })
      }
      set({ loading: false })
    })
  }
}))
