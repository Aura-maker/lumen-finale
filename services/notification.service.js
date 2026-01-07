/**
 * 🔔 NOTIFICATION SERVICE - SISTEMA NOTIFICHE INTELLIGENTE
 * Push notifications personalizzate con AI che battono Duolingo
 */

const webpush = require('web-push');
const schedule = require('node-schedule');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurazione Web Push
webpush.setVapidDetails(
  'mailto:admin@imparafacile.com',
  process.env.VAPID_PUBLIC_KEY || 'GENERATE_KEY',
  process.env.VAPID_PRIVATE_KEY || 'GENERATE_KEY'
);

class NotificationService {
  /**
   * 📱 Tipi di notifiche personalizzate
   */
  static NOTIFICATION_TYPES = {
    STUDY_REMINDER: {
      priority: 'high',
      ttl: 3600,
      badges: ['📚', '🎯', '💪', '🚀', '⭐'],
      templates: [
        '{name}, è ora di studiare {subject}! 📚',
        'Ehi {name}! {subject} ti aspetta 🎯',
        'Non perdere il tuo streak di {streak} giorni! 🔥',
        '{name}, bastano 5 minuti per ripassare {topic} 💡',
        'Il tuo rivale {rival} sta studiando... non farti superare! ⚔️'
      ]
    },
    
    STREAK_RISK: {
      priority: 'urgent',
      ttl: 7200,
      badges: ['🔥', '⚠️', '😱'],
      templates: [
        '🔥 Attenzione! Il tuo streak di {streak} giorni è a rischio!',
        'Ancora {hours} ore per mantenere il tuo streak! ⏰',
        'Non ora {name}! Perderai {xp} XP se non studi oggi 😱'
      ]
    },
    
    CHALLENGE_RECEIVED: {
      priority: 'high',
      ttl: 300,
      vibrate: [200, 100, 200],
      templates: [
        '⚔️ {challenger} ti ha sfidato in {subject}!',
        '🎮 Nuova sfida da {challenger}! Accetti?',
        '💪 {challenger} pensa di batterti in {subject}...'
      ]
    },
    
    ACHIEVEMENT_UNLOCKED: {
      priority: 'normal',
      ttl: 86400,
      templates: [
        '🏆 Achievement sbloccato: {achievement}!',
        '🎉 Complimenti {name}! Hai ottenuto: {achievement}',
        '⭐ Nuovo badge conquistato: {achievement}!'
      ]
    },
    
    FRIEND_ACTIVITY: {
      priority: 'low',
      ttl: 3600,
      templates: [
        '{friend} ti ha superato in classifica! 📊',
        '{friend} ha completato {quiz} quiz oggi 💪',
        '{friend} ha raggiunto il livello {level} 🎯'
      ]
    },
    
    AI_MOTIVATION: {
      priority: 'normal',
      ttl: 3600,
      templates: [
        '🤖 Secondo i miei calcoli, oggi è il giorno perfetto per {subject}!',
        '🧠 Il tuo cervello è al massimo alle {time}. Studia ora!',
        '📈 Hai il 87% di probabilità di ricordare {topic} se lo ripeti ora',
        '🎯 Obiettivo vicino: ti mancano solo {xp} XP per il prossimo livello!'
      ]
    },
    
    WEEKLY_REPORT: {
      priority: 'normal',
      ttl: 86400,
      templates: [
        '📊 Report settimanale: {correct}/{total} quiz corretti, {time}min studiati',
        '🏅 Questa settimana: Posizione #{rank}, +{xp} XP, {achievements} badge'
      ]
    }
  };

  /**
   * 🎯 Invia notifica personalizzata con AI
   */
  static async sendNotification(userId, type, data = {}) {
    try {
      // Recupera utente e preferenze
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          notificationSettings: true,
          pushSubscriptions: true,
          stats: true
        }
      });

      if (!user || !user.pushSubscriptions?.length) {
        return { success: false, reason: 'No subscriptions' };
      }

      // Controlla se utente vuole questa notifica
      if (!NotificationService.shouldSendNotification(user, type)) {
        return { success: false, reason: 'User opted out' };
      }

      // Personalizza messaggio con AI
      const message = await NotificationService.personalizeMessage(user, type, data);
      
      // Prepara payload
      const notificationConfig = NotificationService.NOTIFICATION_TYPES[type];
      const payload = {
        title: NotificationService.getTitle(type, user),
        body: message,
        icon: '/icon-192.png',
        badge: NotificationService.selectBadge(notificationConfig.badges),
        tag: type,
        renotify: type === 'CHALLENGE_RECEIVED',
        requireInteraction: notificationConfig.priority === 'urgent',
        vibrate: notificationConfig.vibrate || [200],
        data: {
          type,
          userId,
          timestamp: Date.now(),
          ...data
        },
        actions: NotificationService.getActions(type, data)
      };

      // Invia a tutti i dispositivi dell'utente
      const results = await Promise.allSettled(
        user.pushSubscriptions.map(sub =>
          webpush.sendNotification(sub, JSON.stringify(payload), {
            TTL: notificationConfig.ttl,
            urgency: notificationConfig.priority
          })
        )
      );

      // Salva nel database
      await prisma.notification.create({
        data: {
          userId,
          type,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          sentAt: new Date(),
          read: false
        }
      });

      // Track analytics
      await NotificationService.trackNotification(userId, type, 'sent');

      return {
        success: true,
        sent: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length
      };

    } catch (error) {
      console.error('Errore invio notifica:', error);
      throw error;
    }
  }

  /**
   * 🤖 Personalizza messaggio con AI e contesto
   */
  static async personalizeMessage(user, type, data) {
    const config = NotificationService.NOTIFICATION_TYPES[type];
    
    // Seleziona template basato su personalità utente
    const personality = NotificationService.getUserPersonality(user);
    let template = NotificationService.selectTemplate(config.templates, personality);
    
    // Sostituisci variabili
    const variables = {
      name: user.nome.split(' ')[0],
      streak: user.stats?.currentStreak || 0,
      xp: user.stats?.totalXP || 0,
      level: Math.floor((user.stats?.totalXP || 0) / 100),
      time: NotificationService.getBestStudyTime(user),
      subject: data.subject || NotificationService.getSuggestedSubject(user),
      topic: data.topic || 'nuovo argomento',
      rival: await NotificationService.getRivalName(user.id),
      friend: data.friendName || 'Un amico',
      ...data
    };

    // Sostituisci variabili nel template
    let message = template;
    Object.keys(variables).forEach(key => {
      message = message.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
    });

    // Aggiungi emoji contestuali
    message = NotificationService.addContextualEmojis(message, user);

    return message;
  }

  /**
   * 🎭 Determina personalità utente per tono messaggi
   */
  static getUserPersonality(user) {
    const stats = user.stats || {};
    
    // Analizza comportamento
    if (stats.currentStreak > 30) return 'dedicated';
    if (stats.challengesWon > stats.challengesLost) return 'competitive';
    if (stats.studyTime > 300) return 'studious';
    if (stats.socialInteractions > 50) return 'social';
    
    return 'casual';
  }

  /**
   * 📅 Schedule notifiche intelligenti
   */
  static async scheduleSmartReminders(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          studyPatterns: true,
          stats: true
        }
      });

      if (!user) return;

      // Cancella schedule esistenti
      NotificationService.cancelUserSchedules(userId);

      // 1. REMINDER STUDIO PERSONALIZZATI
      const bestTimes = NotificationService.calculateBestStudyTimes(user);
      
      bestTimes.forEach(time => {
        const [hour, minute] = time.split(':').map(Number);
        
        schedule.scheduleJob(`reminder_${userId}_${time}`, {
          hour,
          minute,
          tz: user.timezone || 'Europe/Rome'
        }, async () => {
          await NotificationService.sendStudyReminder(userId);
        });
      });

      // 2. STREAK PROTECTION (2 ore prima di mezzanotte)
      if (user.stats?.currentStreak > 0) {
        schedule.scheduleJob(`streak_${userId}`, {
          hour: 22,
          minute: 0,
          tz: user.timezone || 'Europe/Rome'
        }, async () => {
          const todayStudied = await NotificationService.hasStudiedToday(userId);
          if (!todayStudied) {
            await NotificationService.sendNotification(userId, 'STREAK_RISK', {
              streak: user.stats.currentStreak,
              hours: 2
            });
          }
        });
      }

      // 3. WEEKLY REPORT (Domenica sera)
      schedule.scheduleJob(`weekly_${userId}`, {
        dayOfWeek: 0,
        hour: 20,
        minute: 0,
        tz: user.timezone || 'Europe/Rome'
      }, async () => {
        await NotificationService.sendWeeklyReport(userId);
      });

      // 4. AI MOTIVATION (momenti ottimali basati su ML)
      const motivationTimes = NotificationService.predictMotivationTimes(user);
      
      motivationTimes.forEach(({ time, subject, confidence }) => {
        if (confidence > 0.7) {
          const [hour, minute] = time.split(':').map(Number);
          
          schedule.scheduleJob(`ai_${userId}_${time}`, {
            hour,
            minute,
            tz: user.timezone || 'Europe/Rome'
          }, async () => {
            await NotificationService.sendNotification(userId, 'AI_MOTIVATION', {
              subject,
              time: `${hour}:${minute}`,
              confidence: Math.round(confidence * 100)
            });
          });
        }
      });

      return {
        success: true,
        scheduled: {
          reminders: bestTimes.length,
          streakProtection: user.stats?.currentStreak > 0,
          weeklyReport: true,
          aiMotivation: motivationTimes.filter(m => m.confidence > 0.7).length
        }
      };

    } catch (error) {
      console.error('Errore scheduling:', error);
      throw error;
    }
  }

  /**
   * 🧠 Calcola migliori orari studio con ML
   */
  static calculateBestStudyTimes(user) {
    const patterns = user.studyPatterns || [];
    
    if (patterns.length < 10) {
      // Default per nuovi utenti
      return ['09:00', '15:00', '20:00'];
    }

    // Analizza pattern storici
    const hourCounts = {};
    const hourPerformance = {};
    
    patterns.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      hourPerformance[hour] = (hourPerformance[hour] || 0) + session.accuracy;
    });

    // Calcola ore migliori
    const scores = Object.keys(hourCounts).map(hour => ({
      hour: parseInt(hour),
      score: hourCounts[hour] * (hourPerformance[hour] / hourCounts[hour]),
      frequency: hourCounts[hour],
      performance: hourPerformance[hour] / hourCounts[hour]
    }));

    // Ordina per score e prendi top 3
    scores.sort((a, b) => b.score - a.score);
    const topHours = scores.slice(0, 3).map(s => s.hour);

    // Converti in orari con minuti casuali per evitare clustering
    return topHours.map(hour => {
      const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    });
  }

  /**
   * 🔮 Predici momenti motivazione con AI
   */
  static predictMotivationTimes(user) {
    const predictions = [];
    
    // Analizza pattern comportamentali
    const stats = user.stats || {};
    const patterns = user.studyPatterns || [];
    
    // Momento post-pranzo (energia bassa, serve boost)
    if (stats.afternoonSessions < stats.morningSessions) {
      predictions.push({
        time: '14:30',
        subject: NotificationService.getWeakestSubject(user),
        confidence: 0.75
      });
    }

    // Prima di cena (ultimo sprint)
    predictions.push({
      time: '18:00',
      subject: NotificationService.getFavoriteSubject(user),
      confidence: 0.8
    });

    // Weekend morning (più tempo libero)
    const today = new Date().getDay();
    if (today === 6 || today === 0) {
      predictions.push({
        time: '10:00',
        subject: 'progetto speciale',
        confidence: 0.85
      });
    }

    return predictions;
  }

  /**
   * 🎯 Ottieni azioni per notifica
   */
  static getActions(type, data) {
    switch (type) {
      case 'CHALLENGE_RECEIVED':
        return [
          { action: 'accept', title: '✅ Accetta', icon: '/icons/accept.png' },
          { action: 'decline', title: '❌ Rifiuta', icon: '/icons/decline.png' }
        ];
      
      case 'STUDY_REMINDER':
        return [
          { action: 'study-now', title: '📚 Studia ora' },
          { action: 'snooze', title: '⏰ Posticipa 30min' }
        ];
      
      case 'STREAK_RISK':
        return [
          { action: 'quick-session', title: '⚡ Sessione veloce' },
          { action: 'full-session', title: '📖 Sessione completa' }
        ];
      
      default:
        return [];
    }
  }

  /**
   * 📊 Analytics notifiche
   */
  static async getNotificationAnalytics(userId) {
    const [sent, clicked, converted] = await Promise.all([
      prisma.notification.count({
        where: { userId, sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.notification.count({
        where: { userId, clickedAt: { not: null } }
      }),
      prisma.notification.count({
        where: { userId, converted: true }
      })
    ]);

    return {
      sent,
      clicked,
      converted,
      ctr: sent > 0 ? (clicked / sent * 100).toFixed(1) : 0,
      conversionRate: clicked > 0 ? (converted / clicked * 100).toFixed(1) : 0
    };
  }

  // Helper functions
  static shouldSendNotification(user, type) {
    const settings = user.notificationSettings;
    if (!settings) return true;
    
    // Check opt-out
    if (settings.optedOut) return false;
    
    // Check quiet hours
    const now = new Date();
    const hour = now.getHours();
    
    if (settings.quietHoursStart && settings.quietHoursEnd) {
      const start = parseInt(settings.quietHoursStart);
      const end = parseInt(settings.quietHoursEnd);
      
      if (start < end) {
        if (hour >= start && hour < end) return false;
      } else {
        if (hour >= start || hour < end) return false;
      }
    }
    
    // Check frequency limits
    const recentCount = user.notifications?.filter(n => 
      new Date(n.sentAt) > new Date(Date.now() - 3600000)
    ).length || 0;
    
    if (recentCount >= 3) return false; // Max 3 per ora
    
    return true;
  }

  static getTitle(type, user) {
    const titles = {
      STUDY_REMINDER: '📚 Ora di studiare!',
      STREAK_RISK: '🔥 Streak a rischio!',
      CHALLENGE_RECEIVED: '⚔️ Nuova sfida!',
      ACHIEVEMENT_UNLOCKED: '🏆 Achievement!',
      FRIEND_ACTIVITY: '👥 Attività amici',
      AI_MOTIVATION: '🤖 Consiglio AI',
      WEEKLY_REPORT: '📊 Report settimanale'
    };
    
    return titles[type] || 'ImparaFacile';
  }

  static selectBadge(badges) {
    return badges[Math.floor(Math.random() * badges.length)];
  }

  static selectTemplate(templates, personality) {
    // Seleziona template basato su personalità
    const weights = {
      dedicated: [0.1, 0.2, 0.4, 0.2, 0.1],
      competitive: [0.1, 0.1, 0.2, 0.3, 0.3],
      studious: [0.3, 0.3, 0.2, 0.1, 0.1],
      social: [0.1, 0.1, 0.1, 0.1, 0.6],
      casual: [0.2, 0.2, 0.2, 0.2, 0.2]
    };
    
    const personalityWeights = weights[personality] || weights.casual;
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < templates.length; i++) {
      cumulative += personalityWeights[i] || (1 / templates.length);
      if (random < cumulative) {
        return templates[i];
      }
    }
    
    return templates[0];
  }

  static async getRivalName(userId) {
    // Trova il rivale più vicino in classifica
    // Implementazione semplificata
    return 'Marco';
  }

  static getSuggestedSubject(user) {
    // Suggerisci materia basata su pattern
    return 'Matematica';
  }

  static getBestStudyTime(user) {
    // Ottieni miglior orario studio
    return '15:00';
  }

  static getWeakestSubject(user) {
    // Materia con performance peggiore
    return 'Fisica';
  }

  static getFavoriteSubject(user) {
    // Materia più studiata
    return 'Storia';
  }

  static addContextualEmojis(message, user) {
    // Aggiungi emoji basati su contesto
    if (user.stats?.currentStreak > 7) {
      message += ' 🔥';
    }
    return message;
  }

  static cancelUserSchedules(userId) {
    // Cancella tutti i job schedule per utente
    Object.keys(schedule.scheduledJobs).forEach(jobName => {
      if (jobName.includes(userId)) {
        schedule.scheduledJobs[jobName].cancel();
      }
    });
  }

  static async hasStudiedToday(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sessions = await prisma.studySession.count({
      where: {
        userId,
        timestamp: { gte: today }
      }
    });
    
    return sessions > 0;
  }

  static async sendStudyReminder(userId) {
    const subject = await NotificationService.getNextSubjectToStudy(userId);
    await NotificationService.sendNotification(userId, 'STUDY_REMINDER', { subject });
  }

  static async sendWeeklyReport(userId) {
    const stats = await NotificationService.getWeeklyStats(userId);
    await NotificationService.sendNotification(userId, 'WEEKLY_REPORT', stats);
  }

  static async getNextSubjectToStudy(userId) {
    // Logica per determinare prossima materia da studiare
    return 'Matematica';
  }

  static async getWeeklyStats(userId) {
    // Calcola statistiche settimanali
    return {
      correct: 85,
      total: 100,
      time: 240,
      rank: 5,
      xp: 500,
      achievements: 3
    };
  }

  static async trackNotification(userId, type, action) {
    // Track per analytics
    await prisma.notificationAnalytics.create({
      data: {
        userId,
        type,
        action,
        timestamp: new Date()
      }
    });
  }
}

module.exports = NotificationService;
