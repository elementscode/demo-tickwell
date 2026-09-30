import { Request, Response, redirect, session } from "@elements/app";
import { currentUserOrThrow, listMembers } from "#app/shared/services/auth";
import { issues, projectByKeyOrThrow } from "#app/shared/services/tracker";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let user = currentUserOrThrow();
  let project = projectByKeyOrThrow(req.params.key);

  return new html({
    user,
    project,
    members: listMembers(),
    issues: issues.view({ projectId: project.id }),
  });
}
