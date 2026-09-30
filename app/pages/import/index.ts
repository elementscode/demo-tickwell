import { Request, Response, redirect, session } from "@elements/app";
import { adminOrThrow } from "#app/shared/services/auth";
import { projectByKeyOrThrow } from "#app/shared/services/tracker";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let user = adminOrThrow();
  let project = projectByKeyOrThrow(req.params.key);

  return new html({ user, project });
}
