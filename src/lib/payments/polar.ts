import { Polar } from "@polar-sh/sdk";

export function polarClient() {
  return new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    server: "sandbox",
  });
}
