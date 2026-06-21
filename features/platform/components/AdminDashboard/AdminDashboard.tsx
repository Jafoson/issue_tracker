import {
  type AdminUserRow,
  type AdminWorkspaceRow,
  deleteWorkspaceAsAdmin,
  grantPlatformAdmin,
  setUserPlatformAdmin,
  setWorkspaceSuspended,
} from "@/features/platform";
import styles from "./adminDashboard.module.scss";

interface Props {
  locale: string;
  workspaces: AdminWorkspaceRow[];
  admins: AdminUserRow[];
  grantable: AdminUserRow[];
}

export function AdminDashboard({
  locale,
  workspaces,
  admins,
  grantable,
}: Props) {
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const canRevoke = admins.length > 1;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Plattform-Verwaltung</h1>
        <p className={styles.sub}>
          Tenant-Ebene über allen Workspaces. Kein Zugriff auf Inhalte einzelner
          Unternehmen.
        </p>
      </header>

      <section className={styles.section}>
        <h2>
          Workspaces <span className={styles.count}>{workspaces.length}</span>
        </h2>

        {workspaces.length === 0 ? (
          <p className={styles.empty}>Noch keine Workspaces registriert.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Slug</th>
                <th className={styles.num}>Mitglieder</th>
                <th className={styles.num}>Projekte</th>
                <th>Erstellt</th>
                <th>Status</th>
                <th className={styles.actions}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => (
                <tr key={ws.id} data-suspended={ws.suspended || undefined}>
                  <td>
                    <span
                      className={styles.dot}
                      style={{ backgroundColor: ws.color }}
                    />
                    {ws.name}
                  </td>
                  <td className={styles.mono}>{ws.slug}</td>
                  <td className={styles.num}>{ws.memberCount}</td>
                  <td className={styles.num}>{ws.projectCount}</td>
                  <td>{dateFmt.format(ws.createdAt)}</td>
                  <td>
                    {ws.suspended ? (
                      <span className={styles.badgeSuspended}>Gesperrt</span>
                    ) : (
                      <span className={styles.badgeActive}>Aktiv</span>
                    )}
                  </td>
                  <td className={styles.actions}>
                    <form
                      action={setWorkspaceSuspended.bind(
                        null,
                        ws.id,
                        !ws.suspended,
                      )}
                    >
                      <button type="submit" className={styles.btn}>
                        {ws.suspended ? "Entsperren" : "Sperren"}
                      </button>
                    </form>
                    <form action={deleteWorkspaceAsAdmin.bind(null, ws.id)}>
                      <button type="submit" className={styles.btnDanger}>
                        Löschen
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2>
          Plattform-Admins <span className={styles.count}>{admins.length}</span>
        </h2>

        <ul className={styles.adminList}>
          {admins.map((u) => (
            <li key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <span className={styles.muted}> @{u.handle}</span>
                <div className={styles.muted}>{u.email}</div>
              </div>
              <form action={setUserPlatformAdmin.bind(null, u.id, false)}>
                <button
                  type="submit"
                  className={styles.btn}
                  disabled={!canRevoke}
                  title={
                    canRevoke
                      ? undefined
                      : "Der letzte Plattform-Admin kann nicht entzogen werden."
                  }
                >
                  Recht entziehen
                </button>
              </form>
            </li>
          ))}
        </ul>

        {grantable.length > 0 && (
          <form action={grantPlatformAdmin} className={styles.grant}>
            <select name="userId" defaultValue="" required>
              <option value="" disabled>
                User auswählen…
              </option>
              {grantable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <button type="submit" className={styles.btn}>
              Zum Plattform-Admin ernennen
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
