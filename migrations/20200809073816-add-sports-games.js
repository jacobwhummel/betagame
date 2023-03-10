'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.createTable('sports_games', {
    id: {
      type: 'int',
      unsigned: true,
      primaryKey: true,
      autoIncrement: true
    },
    away_team_short_name: {
      type: 'string',
      notNull: true,
    },
    home_team_short_name: {
      type: 'string',
      notNull: true,
    },
    away_team_score: {
      type: 'int'
    },
    home_team_score: {
      type: 'int'
    },
    start_time: {
      type: 'timestamp with time zone',
      notNull: true
    },
    season: {
      type: 'int',
      notNull: true
    },
    week: {
      type: 'int'
    },
    sports_league: {
      type: 'SPORTS_LEAGUE',
      notNull: true,
      defaultValue: 'NFL'
    }
  });
};

exports.down = function(db) {
  return db.dropTable('sports_games');
};

exports._meta = {
  "version": 1
};
