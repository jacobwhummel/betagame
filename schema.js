const { gql } = require('apollo-server');

exports.typeDefs = gql`
  type Pick {
    user: User!
    league: FantasyLeague!
    teams: [SportsTeam!]
    week: Int
  }

  input SubmitPickRequest {
    userID: ID!
    leagueID: ID!
    teamIDs: [ID!]
  }

  type SubmitPickResponse {
    pick: Pick
    errors: [Error!]
  }

  type User {
    email: String!
    displayName: String
    fantasyLeagues: [FantasyLeague!]
  }

  input CreateUserRequest {
    email: String!
  }

  type CreateUserResponse {
    user: User
    errors: [Error!]
  }

  input AddUserToFantasyLeagueRequest {
    userID: ID!
    leagueID: ID!
  }

  type AddUserToFantasyLeagueResponse {
    league: FantasyLeague
    errors: [Error!]
  }

  type FantasyLeague {
    id: ID!
    name: String!
    owner: User!
    members: [User!]
    gameMode: GameMode!
  }

  input CreateFantasyLeagueRequest {
    name: String!
    ownerID: ID!
    gameMode: GameMode!
  }

  type CreateFantasyLeagueResponse {
    league: FantasyLeague
    errors: [Error!]
  }

  type SportsTeam {
    id: ID!
    shortName: String!
    name: String!
    sportsLeague: SportsLeague!
    conference: String
    division: String
  }

  type SportsGame {
    scheduledStart: String
    awayTeam: SportsTeam!
    homeTeam: SportsTeam!
    season: String!
    round: Int
    result: SportsGameResult
  }

  type SportsGameResult {
    startedAt: String
    awayTeamScore: Int
    homeTeamScore: Int
  }

  input CreateSportsGameRequest {
    league: SportsLeague!
    awayTeamShortName: String!
    homeTeamShortName: String!
    scheduledStart: String
    season: String
    round: Int
  }

  type CreateSportsGameResponse {
    sportsGame: SportsGame
    errors: [Error!]
  }

  type Query {
    user(userID: ID, email: String): User
    picksForFantasyLeague(leagueID: ID!, userID: ID, week: Int): [Pick!]
    usersForFantasyLeague(leagueID: ID!): [User!]
    sportsGames(league: SportsLeague!, season: String, week: Int): [SportsGame!]
  }

  type Mutation {
    createUser(request: CreateUserRequest!): CreateUserResponse
    createFantasyLeague(request: CreateFantasyLeagueRequest!): CreateFantasyLeagueResponse
    addUserToFantasyLeague(request: AddUserToFantasyLeagueRequest!): AddUserToFantasyLeagueResponse
    submitPick(request: SubmitPickRequest!): SubmitPickResponse
    createSportsGame(request: CreateSportsGameRequest!): CreateSportsGameResponse
  }

  type Error {
    code: Int!
    message: String
  }

  enum SportsLeague {
    NFL
  }

  enum GameMode {
    PICK_TWO
    STREAKIN
    SURVIVOR
  }
`
