// Fetches the team's CTFtime ranking at build time. The site is rebuilt daily by
// the deploy workflow, so the numbers stay current. CTFtime's API sends no CORS
// headers, so this can't be done in the visitor's browser.

export const CTFTIME_TEAM_ID = 378451;
export const ctftimeTeamUrl = `https://ctftime.org/team/${CTFTIME_TEAM_ID}`;

interface YearRating {
  rating_place?: number;
  country_place?: number;
}

interface TeamResponse {
  name: string;
  country: string;
  rating: Record<string, YearRating>;
}

export interface CtfRanking {
  team: string;
  country: string;
  countryPlace: number;
  worldPlace: number;
  year: number;
}

async function fetchTeam(attempts = 3): Promise<TeamResponse> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`https://ctftime.org/api/v1/teams/${CTFTIME_TEAM_ID}/`, {
        headers: { "User-Agent": "wlundberg.com site build" },
      });
      if (!res.ok) throw new Error(`CTFtime API returned ${res.status}`);
      return (await res.json()) as TeamResponse;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`Could not fetch CTFtime ranking: ${lastError}`);
}

async function getRanking(): Promise<CtfRanking> {
  const team = await fetchTeam();

  // Use the most recent year that has both a world and a country placement
  // (early in a new year the current year may not have one yet).
  const year = Object.keys(team.rating)
    .map(Number)
    .sort((a, b) => b - a)
    .find((y) => team.rating[y].rating_place && team.rating[y].country_place);

  if (!year) throw new Error("CTFtime returned no ranking for the team");

  const country =
    new Intl.DisplayNames(["en"], { type: "region" }).of(team.country) ?? team.country;

  return {
    team: team.name,
    country,
    countryPlace: team.rating[year].country_place!,
    worldPlace: team.rating[year].rating_place!,
    year,
  };
}

// Fails the build if CTFtime is unreachable, so a failed rebuild leaves the
// previously deployed site (with the last good numbers) online.
export const ctfRanking = await getRanking();

export const ctfRankText = `currently ranked #${ctfRanking.countryPlace} in ${ctfRanking.country} and #${ctfRanking.worldPlace} in the world on CTFtime`;
