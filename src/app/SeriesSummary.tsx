import type { PatchSeries } from "../models/patch";

export function SeriesSummary({ series }: { series: PatchSeries }) {
  return (
    <section className="series-summary" aria-labelledby={`${series.id}-summary`}>
      <h2 id={`${series.id}-summary`}>Patch series: {series.subjectStem}</h2>
      <p>
        Version {series.version}, {series.members.length} of {series.total} patches
        {series.incomplete ? " (incomplete)" : ""}.
      </p>
      <ol>
        {series.coverMessageId !== undefined && <li>Cover letter</li>}
        {series.members.map((member) => (
          <li key={member.messageId}>
            <a href={`#message-${encodeURIComponent(member.messageId)}`}>
              Patch {member.index} {member.patchId === undefined ? "" : `(${member.patchId})`}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
