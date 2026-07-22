"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "@/services/documents";
import { queryKeys } from "./queryKeys";

export function useDocuments(docType: string) {
  return useQuery({
    queryKey: queryKeys.documents(docType),
    queryFn: () => fetchDocuments(docType),
  });
}
