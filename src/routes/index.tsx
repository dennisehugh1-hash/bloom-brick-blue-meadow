import { createFileRoute } from "@tanstack/react-router";
import { Appearance } from "@/game/Appearance";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Appearance />;
}
