# thetocque.org DNS — full state before Firebase cutover

Captured 2026-08-11 from GoDaddy DNS Management (registrar: GoDaddy, nameservers
ns13/ns14.domaincontrol.com). Keep this. If anything breaks, this is what the
zone looked like when the site still served from WordPress.com.

| Type | Name | Data | TTL |
|---|---|---|---|
| A | @ | 192.0.78.24 | 600 s |
| A | @ | 192.0.78.25 | 600 s |
| NS | @ | ns13.domaincontrol.com. | 1 h |
| NS | @ | ns14.domaincontrol.com. | 1 h |
| CNAME | www | thetocque.org. | 1 h |
| CNAME | _domainconnect | _domainconnect.gd.domaincontrol.com. | 1 h |
| SOA | @ | Primary nameserver: ns13.domaincontrol.com. | 1 h |
| MX | @ | aspmx.l.google.com. (priority 1) | 1 h |
| MX | @ | alt1.aspmx.l.google.com. (priority 5) | 1 h |
| MX | @ | alt2.aspmx.l.google.com. (priority 5) | 1 h |
| MX | @ | alt3.aspmx.l.google.com. (priority 10) | 1 h |
| MX | @ | alt4.aspmx.l.google.com. (priority 10) | 1 h |
| TXT | @ | google-site-verification=7KLAhz8es3N7DigdHmkcDRdHOwhIPBIhRvI4EvVxCaU | 1 h |
| TXT | @ | v=spf1 include:dc-aa8e722993._spfm.thetocque.org ~all | 1 h |
| TXT | dc-aa8e722993._spfm | v=spf1 include:_spf.google.com ~all | 1 h |

## Cutover diff

Only the apex A records change. Everything else stays exactly as above.

**Add**

| Type | Name | Value |
|---|---|---|
| TXT | @ | hosting-site=thetocque |
| A | @ | 199.36.158.100 |

**Remove**

| Type | Name | Value |
|---|---|---|
| A | @ | 192.0.78.24 |
| A | @ | 192.0.78.25 |

## Do not touch

- **All five MX records** — Google Workspace email. Deleting or replacing these
  silently stops mail delivery, and the failure is not visible from the website.
- **Both SPF TXT records** — the apex one delegates to `dc-aa8e722993._spfm`,
  which delegates to Google. They only work as a pair.
- **The google-site-verification TXT** — removing it drops Search Console access.
- **The `www` CNAME** — points at the apex, so it follows the A records
  automatically once they change.

## Rollback

Re-add `192.0.78.24` and `192.0.78.25` as apex A records and delete
`199.36.158.100`. Apex TTL is 600 s, so recovery is roughly ten minutes.
Rollback only works while the WordPress.com plan is still active — do not cancel
it until the cutover has been stable for a few days.
