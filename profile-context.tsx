"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { CheckIn } from "@/types";
import {
  SEED_MOM,
  type CareTeamMember,
  type Medication,
  type Profile,
} from "@/profile";

interface ProfileContextValue {
  profile: Profile;
  addMedication: (med: Medication) => void;
  addCareTeamMember: (member: CareTeamMember) => void;
  addCheckIn: (checkIn: CheckIn) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(SEED_MOM);

  const addMedication = useCallback((med: Medication) => {
    setProfile((p) => ({ ...p, medications: [...p.medications, med] }));
  }, []);

  const addCareTeamMember = useCallback((member: CareTeamMember) => {
    setProfile((p) => ({ ...p, careTeam: [...p.careTeam, member] }));
  }, []);

  const addCheckIn = useCallback((checkIn: CheckIn) => {
    setProfile((p) => ({
      ...p,
      checkInHistory: [...p.checkInHistory, checkIn],
    }));
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profile, addMedication, addCareTeamMember, addCheckIn }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
