const { executionAsyncResource } = require('async_hooks');
const Discord = require('discord.js');
const { LOADIPHLPAPI } = require('dns');
const { resourceLimits } = require('worker_threads');
const ytdl = require('ytdl-core');

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: "AIzaSyBKfA2Yv9EA_qjXQKbBfkp-DP59_gHoQOU",
    revealed: true
});

const client = new Discord.Client();

const queue = new Map();

client.on("ready", () => {
    console.log("TegezBot zapnut");
})

client.on("message", message => {
    const prefix = '!';

    const serverQueue = queue.get(message.guild.id);

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    switch(command) {
        case 'play':
            execute(message, serverQueue);
            break;
        case 'stop':
            stop(message, serverQueue);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'pause':
            pause(serverQueue); 
            break;
        case 'resume':
            resume(serverQueue);
            break;
        case 'loop':
            loop(args, serverQueue);
            break;
        case 'queue':
            Queue(serverQueue);
            break;
    }
    
    async function execute(message, serverQueue) {
        let vc = message.member.voice.channel;
        if (!vc) {
            return message.channel.send("Bez do voicu demente");
        }
        else {
            let result = await searcher.search(args.join(" "), {type: "video"});
            const songInfo = await ytdl.getInfo(result.first.url);

            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };

            if (!serverQueue) {
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true,
                    loopone: false,
                    loopall: false
                    
                };
                queue.set(message.guild.id, queueConstructor);

                queueConstructor.songs.push(song);

                try {
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                } catch (err) {
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send("nemuzu do voicu mrdko");
                }
            }
            else {
                serverQueue.songs.push(song);
                return message.channel.send(`pridal jsem: ${song.url} :)))`);            
            }
        }
    }
    function play(guild,  song) {
        const serverQueue = queue.get(guild.id);
        if (!song) {
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () => {
                if (serverQueue.loopone) {
                    play(guild, serverQueue.songs[0]);
                }
                else if (serverQueue.loopall) {
                    serverQueue.songs.push(serverQueue.songs[0])
                    serverQueue.songs.shift();
                }
                else {
                    serverQueue.songs.shift();
                }
                play(guild, serverQueue.songs[0]);
            })
        serverQueue.txtChannel.send(`prave hraju: ${serverQueue.songs[0].url} :)))`);
    }
    function stop (message, serverQueue) {
        if (!message.member.voice.channel)
            return message.channel.send("Musis bejt ve voicu kriple");
        if (!serverQueue)
            return message.channel.send("Nemam co stopovat kretene");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
    function skip (message, serverQueue) {
        if (!message.member.voice.channel)
            return message.channel.send("Musis bejt ve voicu kriple");
        if (!serverQueue)
            return message.channel.send("Nemam co skipovat kokote");
        serverQueue.connection.dispatcher.end();
    }
    function pause(serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("Zrovna nic nehraje hluchej kriple");
        if (!message.member.voice.channel)
            return message.channel.send("Nejsi ve voicu kokotko");
        if (serverQueue.connection.dispatcher.paused)
            return message.channel.send("Prave je jeden song pauznutej, tak si ho odpauzni a treba si ho muzes zase pauznout absultni vypatlance");
        serverQueue.connection.dispatcher.pause();
        message.channel.send("Pauznul jsem to :)))");
    }
    function resume(serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("resumni si svuj ztracenej zivot vyjebance nic neni paused");
        if (!message.member.voice.channel)
            return message.channel.send("Musis bejt ve voicu autaku");
        if (serverQueue.connection.dispatcher.resumed)
            return message.channel.send("Ano, resumuju song co prave hraje demente");
        serverQueue.connection.dispatcher.resume();
        message.channel.send("Resumnul jsem to :)))");
    }
    function loop(args, serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("tvoje demence je asi na loopu nic nehraje");
        if (!message.member.voice.channel)
            return message.channel.send("Musis bejt ve voicu autaku");

        switch(args[0].toLowerCase()){
            case 'all':
                serverQueue.loopall = !serverQueue.loopall;
                serverQueue.loopone = false;

                if (serverQueue.loopall === true)
                    message.channel.send("Vse loopuju :)))");
                else    
                    message.channel.send("Prestavam vse loopovat :)))");
                break;
            case 'one':
                serverQueue.loopone = !serverQueue.loopone;
                serverQueue.loopall = false;

                if (serverQueue.loopone === true)
                    message.channel.send("loopuju tenhle song :)))");
                else    
                    message.channel.send("Prestavam loopovat tento song :)))");
                break;
            case 'off':
                serverQueue.loopall = false;
                serverQueue.loopone = false;
                
                message.channel.send("Prestavam vse loopovat :)))");
                break;
            default:
                message.channel.send("nevim co jak proc chces loopovat kkte");
        }
    }
    function Queue(serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("stejne jako fronta zen co na tebe cekaji ani v teto nic neni :)");
        if (!message.member.voice.channel)
            return message.channel.send("Musis bejt ve voicu autaku");

        let nowPlaying = serverQueue.songs[0];
        let qMsg = `Ted hraje: ${nowPlaying.title}\n---------------------\n`;

        for (var i = 1; i < serverQueue.songs.length; i++) {
            qMsg += `${i}. ${serverQueue.songs[i].title}\n`;
        }

        message.channel.send('```' + qMsg + "Vyzadano by: " + message.author.username + '```');
    }
})

client.login("ODk4NTU1MTEzNzYzODk3Mzg0.YWl6qQ.TrBqVwIKM-bOJeYo9siAzuwFX-E");