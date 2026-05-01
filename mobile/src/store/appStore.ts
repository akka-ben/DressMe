import { create } from "zustand";

type AppState = {
  useMocks: boolean;
  setUseMocks: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  useMocks: false,
  setUseMocks: (value) => set({ useMocks: value }),
}));
