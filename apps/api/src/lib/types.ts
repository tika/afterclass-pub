import type { ServiceContext } from "@afterclass/core";

export type AppVariables = {
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    createdAt: Date;
  };
  services: ServiceContext;
};
