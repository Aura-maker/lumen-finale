/**
 * 🏆 LEADERBOARD SERVICE - SISTEMA COMPETITIVO SUPERIORE
 * Batte Duolingo con divisioni, sfide 1v1, tornei settimanali
 */

class LeaderboardService {
  /**
   * 🎖️ Sistema Divisioni come League of Legends
   */
  static DIVISIONS = {
    BRONZE: { 
      name: 'Bronzo', 
      icon: '🥉', 
      minXP: 0,
      rewards: { coins: 10, boost: 1.0 },
      topPromoted: 10,
      color: '#CD7F32'
    },
    SILVER: { 
      name: 'Argento', 
      icon: '🥈', 
      minXP: 500,
      rewards: { coins: 25, boost: 1.1 },
      topPromoted: 7,
      color: '#C0C0C0'
    },
    GOLD: { 
      name: 'Oro', 
      icon: '🥇', 
      minXP: 1500,
      rewards: { coins: 50, boost: 1.2 },
      topPromoted: 5,
      color: '#FFD700'
    },
    PLATINUM: { 
      name: 'Platino', 
      icon: '💎', 
      minXP: 3000,
      rewards: { coins: 100, boost: 1.3 },
      topPromoted: 3,
      color: '#E5E4E2'
    },
    DIAMOND: { 
      name: 'Diamante', 
      icon: '💠', 
      minXP: 5000,
      rewards: { coins: 200, boost: 1.5 },
      topPromoted: 1,
      color: '#B9F2FF'
    },
    MASTER: { 
      name: 'Master', 
      icon: '👑', 
      minXP: 10000,
      rewards: { coins: 500, boost: 2.0 },
      topPromoted: 0,
      color: '#FFD700',
      special: true
    },
    GRANDMASTER: { 
      name: 'Gran Maestro', 
      icon: '🌟', 
      minXP: 25000,
      rewards: { coins: 1000, boost: 3.0, premium: true },
      topPromoted: 0,
      color: '#FF6B6B',
      special: true,
      exclusive: true
    }
  };

  /**
   * 🏁 Ottieni leaderboard con filtri avanzati
   */
  static async getLeaderboard(options = {}) {
    const {
      scope = 'global',      // global, country, region, friends, school
      timeframe = 'week',    // today, week, month, alltime
      division = null,       // filtra per divisione
      materia = null,        // filtra per materia specifica
      limit = 50,
      offset = 0,
      userId = null
    } = options;

    try {
      // Base query
      let query = {};
      
      // Filtro temporale
      const dateFilter = LeaderboardService.getDateFilter(timeframe);
      if (dateFilter) {
        query.lastActivity = { gte: dateFilter };
      }

      // Filtro divisione
      if (division) {
        query.division = division;
      }

      // Filtro scope
      if (scope === 'friends' && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { friends: true }
        });
        query.id = { in: [...user.friends.map(f => f.id), userId] };
      } else if (scope === 'school' && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        query.school = user.school;
      } else if (scope === 'country' && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        query.country = user.country;
      }

      // Calcola XP per periodo
      const users = await prisma.user.findMany({
        where: query,
        include: {
          stats: true,
          achievements: true,
          studySessions: {
            where: dateFilter ? {
              timestamp: { gte: dateFilter }
            } : undefined
          }
        },
        orderBy: materia 
          ? { [`xp_${materia}`]: 'desc' }
          : { totalXP: 'desc' },
        take: limit,
        skip: offset
      });

      // Calcola ranking con statistiche avanzate
      const leaderboard = users.map((user, index) => {
        const xp = LeaderboardService.calculateXP(user, timeframe, materia);
        const stats = LeaderboardService.calculateStats(user, timeframe);
        
        return {
          rank: offset + index + 1,
          id: user.id,
          nome: user.nome,
          avatar: user.avatar,
          division: user.division,
          divisionInfo: LeaderboardService.DIVISIONS[user.division],
          
          // XP e punti
          xp,
          xpGained: LeaderboardService.calculateXPGained(user, timeframe),
          
          // Statistiche
          streak: stats.streak,
          accuracy: stats.accuracy,
          studyTime: stats.studyTime,
          perfectDays: stats.perfectDays,
          
          // Badge e achievements
          badges: user.achievements?.slice(0, 3) || [],
          level: Math.floor(xp / 100),
          
          // Posizione precedente
          previousRank: user.previousRank || offset + index + 1,
          trend: LeaderboardService.getTrend(user, offset + index + 1),
          
          // Sfide
          challengesWon: stats.challengesWon,
          winRate: stats.winRate,
          
          // Bonus attivi
          boosts: LeaderboardService.getActiveBoosts(user),
          
          // Flag speciali
          isCurrentUser: user.id === userId,
          isFriend: false, // Calcolare se è amico
          isRival: false,  // Calcolare se è rivale
          canChallenge: user.id !== userId && user.isOnline
        };
      });

      // Aggiungi informazioni divisione
      const divisionInfo = division ? {
        name: LeaderboardService.DIVISIONS[division].name,
        icon: LeaderboardService.DIVISIONS[division].icon,
        totalUsers: await prisma.user.count({ where: { division } }),
        promotionZone: LeaderboardService.DIVISIONS[division].topPromoted,
        relegationZone: 5,
        rewards: LeaderboardService.DIVISIONS[division].rewards,
        endDate: LeaderboardService.getSeasonEndDate()
      } : null;

      // Trova posizione utente se non in top
      let userPosition = null;
      if (userId && !leaderboard.find(u => u.id === userId)) {
        userPosition = await LeaderboardService.getUserPosition(userId, options);
      }

      return {
        success: true,
        leaderboard,
        divisionInfo,
        userPosition,
        metadata: {
          scope,
          timeframe,
          total: await prisma.user.count({ where: query }),
          lastUpdate: new Date(),
          seasonWeek: LeaderboardService.getCurrentSeasonWeek(),
          nextReset: LeaderboardService.getNextResetDate(timeframe)
        }
      };

    } catch (error) {
      console.error('Errore leaderboard:', error);
      throw error;
    }
  }

  /**
   * ⚔️ Sistema Sfide 1v1 Real-time
   */
  static async createChallenge(challengerId, challengedId, options = {}) {
    const {
      materia = 'random',
      stake = 50,        // XP in palio
      duration = 300,    // 5 minuti
      questions = 10
    } = options;

    try {
      // Verifica che entrambi siano online
      const [challenger, challenged] = await Promise.all([
        prisma.user.findUnique({ where: { id: challengerId } }),
        prisma.user.findUnique({ where: { id: challengedId } })
      ]);

      if (!challenger || !challenged) {
        throw new Error('Utente non trovato');
      }

      if (!challenged.isOnline) {
        throw new Error('Utente non online');
      }

      // Crea sfida
      const challenge = await prisma.challenge.create({
        data: {
          challengerId,
          challengedId,
          materia,
          stake,
          duration,
          questions,
          status: 'pending',
          expiresAt: new Date(Date.now() + 60000) // 1 minuto per accettare
        }
      });

      // Notifica sfidato via WebSocket
      LeaderboardService.notifyChallenge(challengedId, challenge);

      return {
        success: true,
        challenge,
        message: 'Sfida inviata!'
      };

    } catch (error) {
      console.error('Errore creazione sfida:', error);
      throw error;
    }
  }

  /**
   * 🎮 Accetta sfida e inizia match
   */
  static async acceptChallenge(challengeId, userId) {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId }
      });

      if (!challenge || challenge.challengedId !== userId) {
        throw new Error('Sfida non valida');
      }

      if (challenge.status !== 'pending') {
        throw new Error('Sfida già processata');
      }

      if (new Date() > challenge.expiresAt) {
        throw new Error('Sfida scaduta');
      }

      // Genera quiz per la sfida
      const quiz = await LeaderboardService.generateChallengeQuiz(
        challenge.materia,
        challenge.questions
      );

      // Aggiorna sfida
      const updatedChallenge = await prisma.challenge.update({
        where: { id: challengeId },
        data: {
          status: 'active',
          startedAt: new Date(),
          quiz: quiz,
          endAt: new Date(Date.now() + challenge.duration * 1000)
        }
      });

      // Notifica entrambi i giocatori
      LeaderboardService.startMatch(challenge.challengerId, challenge.challengedId, updatedChallenge);

      return {
        success: true,
        challenge: updatedChallenge,
        quiz
      };

    } catch (error) {
      console.error('Errore accettazione sfida:', error);
      throw error;
    }
  }

  /**
   * 📊 Calcola risultato sfida
   */
  static async completeChallengeRound(challengeId, userId, answers, timeSpent) {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId }
      });

      if (!challenge || challenge.status !== 'active') {
        throw new Error('Sfida non attiva');
      }

      // Calcola punteggio
      const score = LeaderboardService.calculateChallengeScore(
        answers,
        challenge.quiz,
        timeSpent
      );

      // Aggiorna risultato
      if (userId === challenge.challengerId) {
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { 
            challengerScore: score,
            challengerTime: timeSpent,
            challengerAnswers: answers
          }
        });
      } else {
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { 
            challengedScore: score,
            challengedTime: timeSpent,
            challengedAnswers: answers
          }
        });
      }

      // Controlla se entrambi hanno finito
      const updated = await prisma.challenge.findUnique({
        where: { id: challengeId }
      });

      if (updated.challengerScore !== null && updated.challengedScore !== null) {
        return await LeaderboardService.finishChallenge(challengeId);
      }

      return {
        success: true,
        score,
        waiting: true,
        message: 'In attesa dell\'avversario...'
      };

    } catch (error) {
      console.error('Errore completamento round:', error);
      throw error;
    }
  }

  /**
   * 🏆 Completa sfida e assegna premi
   */
  static async finishChallenge(challengeId) {
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId }
      });

      // Determina vincitore
      let winner, loser, isDraw = false;
      
      if (challenge.challengerScore > challenge.challengedScore) {
        winner = challenge.challengerId;
        loser = challenge.challengedId;
      } else if (challenge.challengedScore > challenge.challengerScore) {
        winner = challenge.challengedId;
        loser = challenge.challengerId;
      } else {
        // Pareggio - vince chi ha finito prima
        if (challenge.challengerTime < challenge.challengedTime) {
          winner = challenge.challengerId;
          loser = challenge.challengedId;
        } else {
          winner = challenge.challengedId;
          loser = challenge.challengerId;
        }
        isDraw = true;
      }

      // Calcola XP guadagnati/persi
      const winnerXP = challenge.stake;
      const loserXP = -Math.floor(challenge.stake / 2);

      // Aggiorna XP e statistiche
      await Promise.all([
        prisma.user.update({
          where: { id: winner },
          data: {
            totalXP: { increment: winnerXP },
            challengesWon: { increment: 1 },
            winStreak: { increment: 1 }
          }
        }),
        prisma.user.update({
          where: { id: loser },
          data: {
            totalXP: { increment: loserXP },
            challengesLost: { increment: 1 },
            winStreak: 0
          }
        }),
        prisma.challenge.update({
          where: { id: challengeId },
          data: {
            status: 'completed',
            winnerId: winner,
            completedAt: new Date()
          }
        })
      ]);

      // Controlla achievements
      await LeaderboardService.checkChallengeAchievements(winner, loser, challenge);

      return {
        success: true,
        winner,
        loser,
        isDraw,
        winnerXP,
        loserXP,
        challengerScore: challenge.challengerScore,
        challengedScore: challenge.challengedScore
      };

    } catch (error) {
      console.error('Errore completamento sfida:', error);
      throw error;
    }
  }

  /**
   * 🎯 Tornei settimanali automatici
   */
  static async createWeeklyTournament() {
    try {
      // Ottieni top player per divisione
      const divisions = Object.keys(LeaderboardService.DIVISIONS);
      
      for (const division of divisions) {
        const players = await prisma.user.findMany({
          where: { 
            division,
            lastActivity: { 
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          },
          orderBy: { totalXP: 'desc' },
          take: 32 // Per torneo a eliminazione
        });

        if (players.length < 8) continue; // Minimo 8 giocatori

        // Crea torneo
        const tournament = await prisma.tournament.create({
          data: {
            name: `Torneo ${division} - Settimana ${LeaderboardService.getCurrentSeasonWeek()}`,
            division,
            type: 'elimination',
            status: 'registration',
            startDate: LeaderboardService.getNextMonday(),
            endDate: LeaderboardService.getNextSunday(),
            maxParticipants: 32,
            prizes: LeaderboardService.getTournamentPrizes(division)
          }
        });

        // Registra giocatori automaticamente
        for (const player of players) {
          await prisma.tournamentParticipant.create({
            data: {
              tournamentId: tournament.id,
              userId: player.id,
              seed: players.indexOf(player) + 1
            }
          });
        }
      }

      return { success: true, message: 'Tornei creati' };

    } catch (error) {
      console.error('Errore creazione tornei:', error);
      throw error;
    }
  }

  // === HELPER FUNCTIONS ===

  static getDateFilter(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  static calculateXP(user, timeframe, materia) {
    if (materia && user[`xp_${materia}`]) {
      return user[`xp_${materia}`];
    }
    return user.totalXP || 0;
  }

  static calculateXPGained(user, timeframe) {
    // Calcola XP guadagnati nel periodo
    if (!user.studySessions) return 0;
    return user.studySessions.reduce((sum, session) => sum + (session.xpEarned || 0), 0);
  }

  static calculateStats(user, timeframe) {
    return {
      streak: user.currentStreak || 0,
      accuracy: user.accuracy || 0,
      studyTime: user.studyTime || 0,
      perfectDays: user.perfectDays || 0,
      challengesWon: user.challengesWon || 0,
      winRate: user.challengesTotal > 0 
        ? (user.challengesWon / user.challengesTotal * 100).toFixed(1)
        : 0
    };
  }

  static getTrend(user, currentRank) {
    const previous = user.previousRank || currentRank;
    if (currentRank < previous) return 'up';
    if (currentRank > previous) return 'down';
    return 'same';
  }

  static getActiveBoosts(user) {
    const boosts = [];
    
    // Boost divisione
    if (user.division && LeaderboardService.DIVISIONS[user.division]) {
      boosts.push({
        type: 'division',
        multiplier: LeaderboardService.DIVISIONS[user.division].rewards.boost,
        icon: LeaderboardService.DIVISIONS[user.division].icon
      });
    }
    
    // Boost streak
    if (user.currentStreak >= 7) {
      boosts.push({
        type: 'streak',
        multiplier: 1.5,
        icon: '🔥'
      });
    }
    
    // Boost premium
    if (user.isPremium) {
      boosts.push({
        type: 'premium',
        multiplier: 2.0,
        icon: '⭐'
      });
    }
    
    return boosts;
  }

  static getCurrentSeasonWeek() {
    // Calcola settimana corrente della stagione
    const seasonStart = new Date('2024-01-01');
    const now = new Date();
    const diff = now - seasonStart;
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  static getSeasonEndDate() {
    // Ogni stagione dura 3 mesi
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const year = now.getFullYear();
    return new Date(year, (quarter + 1) * 3, 0);
  }

  static getNextResetDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case 'today':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      case 'week':
        return LeaderboardService.getNextMonday();
      case 'month':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth;
      default:
        return null;
    }
  }

  static getNextMonday() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  }

  static getNextSunday() {
    const nextMonday = LeaderboardService.getNextMonday();
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextSunday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);
    return nextSunday;
  }

  static async getUserPosition(userId, options) {
    // Trova posizione esatta dell'utente
    // Implementazione omessa per brevità
    return null;
  }

  static async generateChallengeQuiz(materia, numQuestions) {
    // Genera quiz per sfida
    // Usa il servizio quiz esistente
    return [];
  }

  static calculateChallengeScore(answers, quiz, timeSpent) {
    let score = 0;
    
    answers.forEach((answer, index) => {
      if (answer === quiz[index].correctAnswer) {
        score += 10; // Punti base
        
        // Bonus velocità
        if (timeSpent < 10) score += 5;
        else if (timeSpent < 20) score += 3;
        else if (timeSpent < 30) score += 1;
      }
    });
    
    return score;
  }

  static notifyChallenge(userId, challenge) {
    // Invia notifica WebSocket
    // Implementazione con Socket.io
  }

  static startMatch(player1Id, player2Id, challenge) {
    // Inizia match real-time
    // Implementazione con Socket.io
  }

  static async checkChallengeAchievements(winnerId, loserId, challenge) {
    // Controlla achievement sblocati
    const winner = await prisma.user.findUnique({
      where: { id: winnerId },
      include: { achievements: true }
    });

    const newAchievements = [];

    // Prima vittoria
    if (winner.challengesWon === 1) {
      newAchievements.push('first_blood');
    }

    // 10 vittorie
    if (winner.challengesWon === 10) {
      newAchievements.push('champion');
    }

    // Vittoria perfetta
    if (challenge.challengerScore === 100 || challenge.challengedScore === 100) {
      newAchievements.push('perfect_victory');
    }

    // Win streak
    if (winner.winStreak >= 5) {
      newAchievements.push('unstoppable');
    }

    // Assegna achievements
    for (const achievement of newAchievements) {
      await prisma.userAchievement.create({
        data: {
          userId: winnerId,
          achievementId: achievement,
          unlockedAt: new Date()
        }
      });
    }
  }

  static getTournamentPrizes(division) {
    const base = LeaderboardService.DIVISIONS[division].rewards;
    
    return {
      first: {
        xp: base.coins * 10,
        coins: base.coins * 5,
        badge: `${division}_champion`,
        title: `Campione ${division}`
      },
      second: {
        xp: base.coins * 5,
        coins: base.coins * 3,
        badge: `${division}_runner_up`
      },
      third: {
        xp: base.coins * 3,
        coins: base.coins * 2,
        badge: `${division}_podium`
      },
      participation: {
        xp: base.coins,
        coins: Math.floor(base.coins / 2)
      }
    };
  }
}

module.exports = LeaderboardService;
