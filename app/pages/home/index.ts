import { Request, Response, redirect, session } from "@elements/app";
import { currentUserOrThrow } from "#app/shared/services/auth";
import html, { loadProjects } from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let user = currentUserOrThrow();

  return new html({ user, projects: loadProjects() });
}
