const emailValidator = require('email-validator');

const PG_UNIQUE_VIOLATION = '23505';
const GQL_UNKNOWN_ERROR = 'ERR_UNKNOWN'
const GQL_UNIQUE_VIOLATION = 'ERR_DUPLICATE';
const GQL_INVALID_INPUT = 'ERR_INVALID_INPUT'

const resolvers = {
  Query: {
    async user(parent, { email }, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getUserByEmail(email);
        return result;
      } catch (err) {
        console.log(err.stack);
      }
    },
    async league(parent, { leagueID }, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getLeagueById(leagueID);
        return leagueFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
    async leagues(parent, { userID }, { dataSources }, info) {
      try {
        let result;
        if (userID) {
          result = await dataSources.pg.getLeaguesForUser(userID);
        } else {
          result = await dataSources.pg.getAllLeagues();
        }
        return result.map(function(row) {
          return leagueFromRow(row);
        });
      } catch (err) {
        console.log(err.stack);
      }
    },
    async sportsTeams(parent, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getTeams();
        return result.map(function(row) {
          return teamFromRow(row);
        });
      } catch (err) {
        console.log(err.stack);
      }
    },
    async sportsGames(parent, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getSportsGames();
        return result;
      } catch (err) {
        console.log(err.stack);
      }
    }
  },
  Mutation: {
    async createFantasyLeague(parent, args, context, info) {
      const client = await connectionPool.connect();
      try {
        await client.query('BEGIN');

        const { ownerID, name, gameMode } = args.request;
        const leagueResponse = await client.query('INSERT INTO "fantasy_leagues"(owner_id, name, game_mode) VALUES ($1, $2, $3) returning *', [ownerID, name, gameMode]);

        const createdLeague = leagueResponse.rows[0];

        const membershipResponse = await client.query('INSERT INTO memberships (user_id, league_id) VALUES ($1, $2) returning *', [ownerID, createdLeague.id]);

        await client.query('COMMIT');

        return {
          league: {
            id: createdLeague.id,
            name: createdLeague.name,
            owner: createdLeague.owner_id,
            members: [],
            gameMode: createdLeague.game_mode
          }
        };
      } catch(error) {
        console.log('uh ohhhh');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    },

    async createUser(parent, { request }, { db }, info) {
      const { email } = request;

      if (!emailValidator.validate(email)) {
        return {
          errors: [{
            code: GQL_INVALID_INPUT,
            message: 'Please provide a valid email address.'
          }]
        };
      }

      try {

        const res = await db.query('INSERT INTO "users"(email) VALUES ($1) returning *', [email]);

        const createdUser = res.rows[0];

        return {
          user: {
            id: createdUser.id,
            email: createdUser.email
          }
        };
      } catch (error) {
        let gqlError = {
          code: GQL_UNKNOWN_ERROR,
          message: 'An unknown error occurred'
        }

        const errorCode = error.code;

        if (errorCode == PG_UNIQUE_VIOLATION) {
          gqlError.code = GQL_UNIQUE_VIOLATION;
          gqlError.message = 'A user with that email address already exists.'
        }

        return {
          errors: [gqlError]
        };

      }
    },

    async addUserToFantasyLeague(parent, args, context, info) {
      const client = await connectionPool.connect();
      try {
        const { userID, leagueID } = args.request;

        const res = await client.query('INSERT INTO memberships(user_id, league_id) VALUES ($1, $2) returning *', [userID, leagueID]);

        const createdUser = res.rows[0];

        return {
          league: null
        };
      } catch (error) {
        let gqlError = {
          code: GQL_UNKNOWN_ERROR,
          message: 'An unkonwn error occurred'
        }

        const errorCode = error.code;

        // This currently can't happen because there is no uniqueness constraint
        // on this table included in existing migrations.
        if (errorCode == PG_UNIQUE_VIOLATION) {
          gqlError.code = GQL_UNIQUE_VIOLATION;
          gqlError.message = 'That user is already a member of the specified league.'
        }

        return {
          errors: [gqlError]
        };
      } finally {
        client.release();
      }
    },

    async submitPick(parent, { request }, { db }, info) {
      if (validatePick(request)) {
        const picks = registerPick(request);
        if (!picks) {
          return {
            picks: null,
            errors: [{
              code: GQL_UNKNOWN_ERROR,
              message: 'Storing the pick failed. Please retry.'
            }]
          };
        }
      } else {
        return {
          picks: null,
          errors: [{
            code: GQL_INVALID_INPUT,
            message: 'The submitted pick is invalid.'
          }]
        }
      }
    }
  },
  SportsGame: {
    async awayTeam(game, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getTeam(game.awayTeamShortName, game.sportsLeague);
        return teamFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
    async homeTeam(game, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getTeam(game.homeTeamShortName, game.sportsLeague);
        return teamFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
    async result(game, args) {
      if (game.awayTeamScore === null || game.homeTeamScore === null) {
        return null;
      }
      return {
        awayTeamScore: game.awayTeamScore,
        homeTeamScore: game.homeTeamScore
      };
    }
  },
  FantasyLeague: {
    async owner(league, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getLeagueOwner(league.id, league.ownerID);
        return userFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
    async users(league, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getLeagueMembers(league.id);
        return result.map(function(row) {
          return userFromRow(row);
        });
      } catch (err) {
        console.log(err.stack);
      }
    },
    async picks(league, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getPicksForLeague(league.id);
        return result.map(function(row) {
          return pickFromRow(row);
        });
      } catch (err) {
        console.log(err.stack);
      }
    }
  },
  Pick: {
    async user(pick, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getUserById(pick.userID);
        return result;
      } catch (err) {
        console.log(err.stack);
      }
    },
    async league(pick, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getLeagueById(pick.leagueID);
        return leagueFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
    async team(pick, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getTeamById(pick.teamID);
        return teamFromRow(result);
      } catch (err) {
        console.log(err.stack);
      }
    },
  },
  User: {
    async fantasyLeagues(user, args, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getLeaguesForUser(user.id);
        return result.map(function(row) {
          return leagueFromRow(row);
        });
      } catch (err) {
        console.log(err.stack);
      }
    },

    async displayName(user, { leagueID }, { dataSources }, info) {
      try {
        const result = await dataSources.pg.getUserDisplayNameForLeague(user.id, leagueID);
        return result.display_name;
      } catch (err) {
        console.log(err.stack);
      }
    },
  }
};

async function registerPick(pickRequest, db) {
  const { leagueID } = pickRequest;
  const result = await db.query('SELECT game_mode FROM fantasy_leagues WHERE id = $1 LIMIT 1', [leagueID]);
  if (result.rows.length === 0){

    // Fantasy league not found
    return false;
  } else if (result.rows[0].game_mode === 'PICK_TWO'){
    return registerPickTwoPick(pickRequest, db);
  } else {

    // Unrecognized game mode
    return false;
  }
}

async function registerPickTwoPick(pickRequest, db) {
  const { userID, leagueID, teamIDs, week } = pickRequest;
  let responseRows = [];

  try {

    // Begin transaction
    await db.query('BEGIN');

    // Invalidate any existing picks for this week
    await db.query('UPDATE picks SET invalidated_at=CURRENT_TIMESTAMP WHERE week = $1 AND invalidated_at IS NULL', [week]);

    // Create a pick row for each team included in the pick
    for (const teamID of teamIDs) {
      const response = await db.query('INSERT INTO picks(league_id, user_id, team_id, week) VALUES ($1, $2, $3, $4)', [leagueID, userID, teamID, week]);
      responseRows.push(response.rows[0]);
    }

    // Commit transaction
    await db.query('COMMIT')
  } catch (e) {
    await db.query('ROLLBACK')
    return false;
  }

  return responseRows;
}

async function validatePick(pickRequest, db) {
  const { leagueID } = pickRequest;
  const result = await db.query('SELECT game_mode FROM fantasy_leagues WHERE id = $1 LIMIT 1', [leagueID]);
  if (result.rows.length === 0){

    // Fantasy league not found
    return false;
  } else if (result.rows[0].game_mode === 'PICK_TWO'){
    return validatePickTwoPick(pickRequest, db);
  } else {

    // Unrecognized game mode
    return false;
  }
}

async function validatePickTwoPick(pickRequest, db) {
  const { userID, leagueID, teamIDs, week } = pickRequest;

  const pastPicks = await db.query('SELECT * FROM picks WHERE league_id = $1 AND user_id = $2 AND week != $3 AND invalidated_at IS NULL ', [leagueID, userID, week]);

  // Check if any picked team has been picked before
  for (const row of pastPicks.rows) {
    if (teamIDs.includes(row.team_id)) {
      // At least one of these teams has already been picked by this player
      return false;
    }
  }

  // TODO: Make sure the picked team has a game in the specified week

  // Looks like a valid pick
  return true;
}

function pickFromRow(row) {
  return {
    week: row.week,
    isInvalidated: !(row.invalidated_at === null),

    // Not schema fields, but used by subresolvers
    userID: row.user_id,
    leagueID: row.league_id,
    teamID: row.team_id
  }
}

function userFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  }
}

function leagueFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    gameMode: row.game_mode,
    currentWeek: parseInt(process.env.CURRENT_WEEK) || 1,

    // Not schema fields, but used by subresolvers
    ownerID: row.owner_id
  };
}

function teamFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    sportsLeague: row.sports_league
  };
}

function gameFromRow(row) {
  return {
    id: row.id,
    sportsLeague: row.sports_league,
    startsAt: row.start_time,
    week: row.week,

    // Not schema fields, but used by subresolvers
    awayTeamShortName: row.away_team_short_name,
    homeTeamShortName: row.home_team_short_name,
    awayTeamScore: row.away_team_score,
    homeTeamScore: row.home_team_score
  };
}

exports.resolvers = resolvers;
