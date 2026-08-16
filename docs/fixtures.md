# Fixture and test-data policy

Tests use small synthetic RFC822/MIME, mbox, HTML, quote, patch, and malformed
input fixtures. Each fixture is generated or authored for the behavior it
proves; it is not presented as a copy of a public mailing-list archive.

The stress suite generates its 500-message/depth-100 thread and 10,000-line
patch at test time, so large binary or mail fixtures are not committed. The
TICKET-001 endpoint measurements identify a representative public filelock
thread and retain only its observed sizes, headers, and access results in the
spike report. Public mail remains potentially copyrighted and is not treated
as public-domain test data.

When a regression needs a realistic sample, prefer a minimal synthetic fixture
with documented provenance and purpose. Do not silently update golden output;
change the fixture and its assertion deliberately.
