import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../utils/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { NdviPoint } from '../utils/ndviService';

export interface Parcel {
  id: string;
  name: string;
  location: string;
  size: string;
  crop: string;
  ndvi: number | null;
  moisture: number | null;
  temperature: number | null;
  windSpeed: number | null;
  status: 'Healthy' | 'Needs Attention' | 'Warning' | 'Pending';
  image: string;
  date: string;
  // Boundary can be a single path (simple polygon) or array of paths (multipolygon)
  boundary?: { lat: number; lng: number }[] | { lat: number; lng: number }[][];
  userId?: string;
  agroId?: string;
  
  // New fields for Scalable Caching
  ndviHistory?: NdviPoint[]; 
  lastAgroSync?: number; // Timestamp of last successful API fetch
  weatherCache?: {
    data: any;
    timestamp: number;
  };
  soilCache?: {
    data: any;
    timestamp: number;
  };
  geeLayers?: {
    [layerType: string]: {
      url: string;
      timestamp: number;
    }
  };
}

export type NewParcelData = Omit<Parcel, 'id' | 'userId'>;

interface ParcelContextType {
  parcels: Parcel[];
  addParcel: (parcel: NewParcelData) => Promise<void>;
  updateParcel: (id: string, data: Partial<Parcel>) => Promise<void>;
  loading: boolean;
}

const ParcelContext = createContext<ParcelContextType | undefined>(undefined);

export const ParcelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  // Start loading as true to prevent premature empty state
  const [loading, setLoading] = useState(true);
  const { currentUser, loading: authLoading } = useAuth();

  useEffect(() => {
    // Critical: Do not run logic while Auth is still initializing.
    // This prevents the context from seeing 'null' user during page reload and clearing data.
    if (authLoading) return;

    if (!currentUser) {
      setParcels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const parcelsRef = collection(db, 'parcels');
    // Query specifically for the current user's data
    const q = query(parcelsRef, where('userId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedParcels: Parcel[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let boundary = data.boundary;

        // Hydrate MultiPolygon from Firestore storage format (Object wrapper)
        // Firestore doesn't support nested arrays, so we wrap them in an object { type: 'multi', rings: [...] }
        if (boundary && typeof boundary === 'object' && !Array.isArray(boundary) && boundary.type === 'multi') {
             boundary = boundary.rings.map((r: any) => r.points);
        }

        return {
            id: doc.id,
            ...data,
            boundary: boundary
        } as Parcel;
      });
      
      setParcels(loadedParcels);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching parcels:", error);
      // Even on error, we stop loading so the UI can show something (e.g. empty state or error message)
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, authLoading]);

  const addParcel = async (parcelData: NewParcelData) => {
    if (!currentUser) throw new Error("User must be logged in to add a parcel");

    try {
      let boundaryToSave = parcelData.boundary;

      // Firestore Limitation Fix:
      // Firestore throws "Invalid data. Nested arrays are not supported" for MultiPolygons (Array<Array<Object>>).
      // We detect this structure and wrap it in an object.
      if (Array.isArray(boundaryToSave) && boundaryToSave.length > 0 && Array.isArray(boundaryToSave[0])) {
          boundaryToSave = {
              type: 'multi',
              rings: boundaryToSave.map(ring => ({ points: ring }))
          } as any;
      }

      await addDoc(collection(db, 'parcels'), {
        ...parcelData,
        boundary: boundaryToSave,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding parcel: ", error);
      throw error;
    }
  };

  const updateParcel = async (id: string, data: Partial<Parcel>) => {
    if (!currentUser) throw new Error("User must be logged in to update a parcel");

    try {
      let dataToUpdate = { ...data };

      // Apply the same serialization logic for updates
      if (dataToUpdate.boundary && Array.isArray(dataToUpdate.boundary) && dataToUpdate.boundary.length > 0 && Array.isArray(dataToUpdate.boundary[0])) {
          dataToUpdate.boundary = {
              type: 'multi',
              rings: dataToUpdate.boundary.map((ring: any) => ({ points: ring }))
          } as any;
      }

      const parcelRef = doc(db, 'parcels', id);
      await updateDoc(parcelRef, dataToUpdate);
    } catch (error) {
      console.error("Error updating parcel: ", error);
      throw error;
    }
  };

  return (
    <ParcelContext.Provider value={{ parcels, addParcel, updateParcel, loading }}>
      {children}
    </ParcelContext.Provider>
  );
};

export const useParcels = () => {
  const context = useContext(ParcelContext);
  if (!context) {
    throw new Error('useParcels must be used within a ParcelProvider');
  }
  return context;
};