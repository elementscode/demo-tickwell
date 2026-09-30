import { App } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import board from "#app/pages/board";
import issue from "#app/pages/issue";
import issueList from "#app/pages/issue-list";
import team from "#app/pages/team";
import invitePage from "#app/pages/invite";
import importPage from "#app/pages/import";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/projects/:key", board);
app.route("/projects/:key/issues", issueList);
app.route("/projects/:key/import", importPage);
app.route("/issues/:key", issue);
app.route("/team", team);
app.route("/invite/:token", invitePage);

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
