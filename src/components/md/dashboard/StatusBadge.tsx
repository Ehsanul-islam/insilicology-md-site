import { STATUS_LABEL, type RecordStatus } from "../../../lib/dashboard/validate";

export function StatusBadge({ status, live }: { status: RecordStatus; live?: boolean }) {
  return (
    <span className="md-badge" data-status={status}>
      {STATUS_LABEL[status]}
      {live && status !== "published" ? " · live copy online" : ""}
    </span>
  );
}
