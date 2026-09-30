import { Request, Response, redirect, session } from "@elements/app";
import { currentUserOrThrow, listMembers } from "#app/shared/services/auth";
import { listInvites } from "./services";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let user = currentUserOrThrow();

  return new html({
    user,
    members: listMembers(),
    invites: user.role === "admin" ? listInvites() : [],
  });
}
