/* The decision rules the staging acceptance uses to call something "denied".
 *
 * They live in their own file because they are the part most likely to be wrong in a way that
 * looks right. A denial written as !(status===200 && isArray && length>0) is satisfied by a 500,
 * by a timeout page, by a 200 carrying an object instead of an array, and by any error at all -
 * so a harness built on it reports "denied" when the truth is "we do not know". Director review
 * of 8 November 2026 required these to be non-vacuous and separately negative-controlled.
 *
 * Pure functions, no network, no state. test/auth-acceptance-predicates.test.mjs feeds them
 * adversarial responses and requires them to refuse the bogus ones.
 */

/** What a response actually is, before anyone calls it a denial. */
export function classify(res) {
  if (!res || typeof res.status !== 'number') return 'unusable';
  const {status, data} = res;
  if (status >= 500) return 'server_error';          // the server broke: no security conclusion
  if (status === 401 || status === 403) return 'refused_auth';
  if (status >= 400) return 'other_4xx';             // 400, 404, 429 - not an authorization answer
  if (status === 200 || status === 206) {
    if (Array.isArray(data)) return data.length === 0 ? 'empty' : 'rows';
    return 'malformed';                              // 200 with a non-array body
  }
  return 'unusable';
}

/* A read was genuinely denied only if the server refused it on authorization grounds, or
 * answered normally with no rows. A 500, a 404, a rate limit or a non-array body prove nothing,
 * and this returns false for every one of them. */
export const isGenuineDenial = res => ['refused_auth', 'empty'].includes(classify(res));

/* A read genuinely returned data: a 200 carrying a non-empty array and nothing else. */
export const isGenuineRead = res => classify(res) === 'rows';

/* An invalid or tampered token must be refused explicitly. PostgREST answers a bad JWT with 401,
 * and 403 is accepted as the documented equivalent. Anything else - including an empty 200,
 * which would mean the token was ACCEPTED and merely filtered by RLS - is not a pass here. */
export const isExplicitlyUnauthorized = res => classify(res) === 'refused_auth';

/* Credentials that a response body can legitimately carry. A GoTrue token response is the one
 * body this routinely sees that holds a usable bearer secret, and a failure message must not
 * print it: the 160-character cut is not a redaction, it is an accident of field ordering. */
const CREDENTIAL_FIELDS =
  /("(?:access_token|refresh_token|id_token|provider_token|provider_refresh_token)"\s*:\s*")[^"]*(")/g;

/* Why a response was rejected, for a failure message that tells the reader something.
 * Never throws, whatever the body is, and never prints a bearer credential. */
export function explain(res) {
  try {
    const kind = classify(res);
    let detail;
    try {
      detail = String(JSON.stringify(res?.data)).replace(CREDENTIAL_FIELDS, '$1[redacted]$2').slice(0, 160);
    } catch { detail = '[unserialisable]'; }
    return `http ${res?.status} classified ${kind} body ${detail}`;
  } catch {
    return 'http [unreadable] classified unusable body [unserialisable]';
  }
}
