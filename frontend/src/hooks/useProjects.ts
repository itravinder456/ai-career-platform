"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/services/projects";
import { queryKeys } from "./queryKeys";

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: fetchProjects });
}
