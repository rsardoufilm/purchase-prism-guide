import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/despesas")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Despesas — AURA Finance" }] }),
});
