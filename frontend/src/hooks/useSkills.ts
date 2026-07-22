"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSkills } from "@/services/skills";
import { queryKeys } from "./queryKeys";

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills, queryFn: fetchSkills });
}
