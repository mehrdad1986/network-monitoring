FIRST 2,000 WEBSITE LIST — RANK AND COUNTRY/ORIGIN METADATA

Files:
- world_top_2000_with_rank_and_country.csv: CSV with machine-readable columns.
- world_top_2000_with_rank_and_country.txt: tab-separated TXT, designed for scripts that need rank + country in failed-access reports.

Rows and rank:
- Exactly 2000 unique domains, preserving the exact order of world_top_2000_websites.txt.
- `rank` is the domain's line position in the prior file (1–2000). Because that earlier list combined ranked-source material with curated additions, it is not an audited global traffic rank for every row.
- `tranco_snapshot_rank_if_present` is the position of the domain in the local Tranco-derived snapshot file. It is historical/limited to the local snapshot; blank means the domain was not present in that file, not necessarily that it is globally unranked.
- Tranco explains that ranking providers differ and that its standard list combines multiple providers over a rolling period: https://tranco-list.eu/methodology

Country field:
- `country_or_origin` is a best-effort primary operator/publisher origin or market association.
- For many ccTLDs (e.g., .ru or .de), country is inferred from the suffix and may indicate the main market rather than the operator's legal domicile.
- Global / multi-country infrastructure includes CDN, DNS, ad-tech or delivery domains that do not map neatly to one country.
- `Unknown / international (.com/.net/etc.)` means the country cannot be assigned confidently from the domain alone. No location has been guessed merely to avoid a blank.
- This field is not the physical server location and does not tell you whether a domain is blocked from a particular network.
- Confidence describes the strength of the country association, not whether a domain is reachable.

Counts:
- Rows: 2000
- Unique domains: 2000
- Domains matching the local Tranco-derived snapshot: 1502
- Low-confidence country/origin entries: 623

Country/origin labels by count:
- United States: 767
- Unknown / international (.com/.net/etc.): 618
- Global / multi-country infrastructure: 153
- China: 78
- Russia: 70
- Japan: 36
- Germany: 31
- India: 27
- United Kingdom: 22
- South Korea: 21
- France: 20
- Brazil: 12
- Canada: 11
- Italy: 11
- Israel: 8
- Spain: 8
- Poland: 8
- Netherlands: 7
- Australia: 6
- Unknown / needs verification: 5
- Norway: 5
- Turkey: 5
- Global / internet infrastructure: 4
- Sweden: 4
- Czechia: 4
- Switzerland: 4
- Ukraine: 4
- Denmark: 3
- Bulgaria: 3
- Finland: 3
- New Zealand: 3
- United Arab Emirates: 2
- Argentina: 2
- Greece: 2
- Mexico: 2
- Portugal: 2
- Vietnam: 2
- Croatia: 2
- South Africa: 2
- Pakistan: 2
- International / multinational: 1
- European Union: 1
- Reserved / example domain: 1
- Estonia: 1
- Switzerland / international organization: 1
- Global / open-source infrastructure: 1
- Reserved / internet infrastructure: 1
- Latvia: 1
- Slovakia: 1
- Kazakhstan: 1
- Belgium: 1
- Romania: 1
- Iran: 1
- Serbia: 1
- Lithuania: 1
- Taiwan: 1
- Indonesia: 1
- Philippines: 1
- Faroe Islands: 1
- Moldova: 1
- Peru: 1
