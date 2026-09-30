import { Job, email, getAppUrl, sql } from "@elements/app";
import InviteEmail from "#app/emails/invite";

export interface SendInviteJobFields {
  inviteId: string;
}

export class SendInviteJob extends Job<SendInviteJobFields> {
  run() {
    let invite = sql<{ email: string; role: string; token: string; inviterName: string | null }>(`
      select i.email, i.role, i.token, u.name as inviterName
        from invites i
        left join users u on u.id = i.invitedById
       where i.id = ${this.fields.inviteId}
         and i.acceptedAt is null
    `).first();

    if (!invite) {
      return;
    }

    email({
      to: invite.email,
      subject: `${invite.inviterName ?? "Your team"} invited you to tickwell`,
      body: new InviteEmail({
        inviterName: invite.inviterName ?? "Your team",
        role: invite.role,
        url: `${getAppUrl()}/invite/${invite.token}`,
      }),
    });
  }
}
