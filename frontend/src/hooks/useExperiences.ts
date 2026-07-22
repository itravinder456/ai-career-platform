"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchExperiences } from "@/services/experiences";
import { queryKeys } from "./queryKeys";

export function useExperiences() {
  return useQuery({ queryKey: queryKeys.experiences, queryFn: fetchExperiences });
}
