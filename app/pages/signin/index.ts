import { Request, Response, redirect, session } from "@elements/app";
import html, { DEMO_LOGINS } from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/");
    return;
  }

  // The seeded accounts exist only on the development database.
  let demoLogins = process.env.ENV === "development" ? DEMO_LOGINS : [];

  return new html({ demoLogins });
}
