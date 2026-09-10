1.Make sure there is no personal info in the code,and no names

2.**Readability** Could a teammate understand this code in six months without asking the author?

3.make sure the code is production worthy and not have any hardcoded results

4.**Dependencies** were any new packages added? if so are they actually necessary and from a trusted source?

5.**Security** Are secret keys, credentials, and configuration flags stored in .env rather than hardcoded in source files?

6.**Error Handling** Does the backend catch potential failures(e.g.,API timeouts, missing fields) without crashing the server?

7.**Input Validation** Are incoming request bodies and query parameters sanitized to prevent malformed data or injection vulnerabilities?

8.**Code Formatting** Is formatting consistent, unused imports/variables removed, and console debug statements cleaned up?