'use strict';

// SüffIQ: bewusst nur Party-/Club-/Festival-/Rap-Banger.
// Feste YouTube-IDs = kein YouTube-Data-API-Key nötig.
// `start` setzt einen markanten Einstieg; ab dort läuft der Song am Stück.
module.exports = [
  // Festival / EDM / David Guetta
  { title: 'We Are The People', artist: 'Empire Of The Sun', videoId: 'a47Y1lCRHlM', start: 41, aliases: ['We Are the People'] },
  { title: 'Memories', artist: 'David Guetta feat. Kid Cudi', videoId: 'NUVCQXMUVnI', start: 38 },
  { title: 'Titanium', artist: 'David Guetta feat. Sia', videoId: 'JRfuAukYTKg', start: 45 },
  { title: 'Levels', artist: 'Avicii', videoId: '_ovdm2yX4MA', start: 18 },
  { title: 'Wake Me Up', artist: 'Avicii', videoId: 'IcrbM1l_BoI', start: 43 },
  { title: 'Animals', artist: 'Martin Garrix', videoId: 'gCYcHz2k5x0', start: 47 },
  { title: "Don't You Worry Child", artist: 'Swedish House Mafia', videoId: '1y6smkh6c-0', start: 52, aliases: ['Dont You Worry Child'] },
  { title: 'Turn Down for What', artist: 'DJ Snake & Lil Jon', videoId: 'HMUDVMiITOU', start: 20, aliases: ['Turn Down For What'] },
  { title: 'Lean On', artist: 'Major Lazer & DJ Snake feat. MØ', videoId: 'YqeW9_5kURI', start: 35 },
  { title: 'Faded', artist: 'Alan Walker', videoId: '60ItHLz5WEA', start: 36 },
  { title: 'Rather Be', artist: 'Clean Bandit feat. Jess Glynne', videoId: 'm-M1AtrxztU', start: 42 },
  { title: 'Get Lucky', artist: 'Daft Punk feat. Pharrell Williams', videoId: '5NV6Rdv1a3I', start: 30 },

  // 2000er / 2010er Abriss
  { title: 'I Gotta Feeling', artist: 'The Black Eyed Peas', videoId: 'uSD4vsh1zDA', start: 42 },
  { title: 'Party Rock Anthem', artist: 'LMFAO', videoId: 'KQ6zr6kCPj8', start: 46 },
  { title: 'Timber', artist: 'Pitbull feat. Kesha', videoId: 'hHUbLv4ThOo', start: 38 },
  { title: 'Yeah!', artist: 'Usher feat. Lil Jon & Ludacris', videoId: 'GxBSyx85Kp8', start: 29, aliases: ['Yeah'] },
  { title: 'Low', artist: 'Flo Rida feat. T-Pain', videoId: 'U2waT9TxPU0', start: 27 },
  { title: 'Uptown Funk', artist: 'Mark Ronson feat. Bruno Mars', videoId: 'OPf0YbXqDm0', start: 30 },
  { title: 'Gangnam Style', artist: 'PSY', videoId: '9bZkp7q19f0', start: 42 },
  { title: 'Despacito', artist: 'Luis Fonsi feat. Daddy Yankee', videoId: 'kJQP7kiw5Fk', start: 51 },
  { title: 'Bad Romance', artist: 'Lady Gaga', videoId: 'qrO4YZeyl0I', start: 52 },
  { title: 'Toxic', artist: 'Britney Spears', videoId: 'LOZuxwVk7TU', start: 48 },
  { title: 'Umbrella', artist: 'Rihanna feat. Jay-Z', videoId: 'CvBfHwUxHIk', start: 48 },
  { title: 'Firework', artist: 'Katy Perry', videoId: 'QGJuMBdaqIw', start: 46 },
  { title: 'Shake It Off', artist: 'Taylor Swift', videoId: 'nfWlot6h_JM', start: 42 },
  { title: 'Blinding Lights', artist: 'The Weeknd', videoId: '4NRXx6U8ABQ', start: 21 },

  // Rap / Hip-Hop / Deutschrap
  { title: 'In Da Club', artist: '50 Cent', videoId: '5qm8PH4xAss', start: 18, aliases: ['In The Club'] },
  { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis feat. Ray Dalton', videoId: '2zNSgSzhBfM', start: 54, aliases: ['Cant Hold Us'] },
  { title: 'Thrift Shop', artist: 'Macklemore & Ryan Lewis feat. Wanz', videoId: 'QK8mJJJvaes', start: 32 },
  { title: 'Lose Yourself', artist: 'Eminem', videoId: '_Yhyp-_hX2s', start: 24 },
  { title: 'Roller', artist: 'Apache 207', videoId: 'Fo3DAhiNKQo', start: 30 },

  // Rock-/Mitsing-Banger für die spätere Stunde
  { title: 'The Final Countdown', artist: 'Europe', videoId: '9jK-NcRmVcw', start: 22, aliases: ['Final Countdown'] },
  { title: 'Thunderstruck', artist: 'AC/DC', videoId: 'v2AC41dglnM', start: 25 },
  { title: "Livin' on a Prayer", artist: 'Bon Jovi', videoId: 'lDK9QqIzhwk', start: 47, aliases: ['Living on a Prayer'] },
  { title: "Sweet Child O' Mine", artist: "Guns N' Roses", videoId: '1w7OgIMMRc4', start: 58, aliases: ['Sweet Child of Mine'] },
  { title: 'Take On Me', artist: 'a-ha', videoId: 'djV11Xbc914', start: 45 },
  { title: 'Du hast', artist: 'Rammstein', videoId: 'W3q8Od5qJio', start: 43, aliases: ['Du Hast'] }
];
