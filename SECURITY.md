# Security

## Supported use

The keyless preview can be hosted publicly. The Express server and its API-backed mode are for
local Test-mode development only. Do not deploy the API-backed server to a public environment.

The example rejects live Open Border keys. Keep Test secret keys in an ignored `.env` file and
never expose `OPENBORDER_API_KEY` to browser code, logs, analytics, screenshots, or commits.

## Reporting a vulnerability

Please report security issues privately through the security contact listed at
[openborder.com](https://openborder.com). Do not open a public issue containing credentials,
payment data, customer data, or exploit details.
