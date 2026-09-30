import { Request, Response } from "@elements/app";
import html, { findInvite } from "./template";

export default function route(req: Request, res: Response) {
  return new html({ token: req.params.token, invite: findInvite(req.params.token) ?? null });
}
