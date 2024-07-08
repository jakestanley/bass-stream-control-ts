// src/index.ts
import { Ableton } from "ableton-js";
import OBSWebSocket from "obs-websocket-js"
import { TimeFormat } from "ableton-js/ns/song";

const SYNC_THRESHOLD = 2000;

const ableton = new Ableton({ logger: console });
const obs = new OBSWebSocket();
const videos = ["BackgroundVideo", "ForegroundVideo"];
// TODO: args

const load = async(obs: OBSWebSocket) => {
    // TODO load videos into OBS and load Ableton set?
}

const obs_sync = async (obs: OBSWebSocket) => {

    const msTime = await ableton.song.getCurrentSmpteSongTime(TimeFormat.MsTime);
    const msTimeLong = msTime.frames + (msTime.seconds * 1000) + (msTime.minutes * 60 * 1000) + (msTime.hours * 60 * 60 * 1000);

    const videoTimeBg = await obs.call("GetMediaInputStatus", {
        inputName: videos[0]
    });
    const videoTimeFg = await obs.call("GetMediaInputStatus", {
        inputName: videos[1]
    });

    if (Math.abs(videoTimeBg.mediaCursor - msTimeLong) > SYNC_THRESHOLD || Math.abs(videoTimeFg.mediaCursor - msTimeLong) > SYNC_THRESHOLD) {
        console.log(`At least one video is out of sync by ${SYNC_THRESHOLD}ms. Synchronising to Ableton (${msTimeLong}ms)`);
        for (const video of videos) {
            obs
                .call("TriggerMediaInputAction", {
                    inputName: video,
                    mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE"
                })
                .then(() => {
                    obs.call("SetMediaInputCursor", {
                        inputName: video,
                        mediaCursor: msTimeLong
                    })
                .then(() => {
                    obs.call("TriggerMediaInputAction", {
                        inputName: video,
                        mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY"
                    });
                })
            });
        }
    }
};

const obs_restart = async(obs: OBSWebSocket) => {
    for (const video of videos) {
        obs.call("TriggerMediaInputAction", {
            inputName: video,
            mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART"
        });
    }
}

const obs_pause = async(is_playing: boolean, obs: OBSWebSocket) => {
    console.log("Playback " + (is_playing ? "started" : "stopped"))
    for (const video of videos) {
        obs.call("TriggerMediaInputAction", {
            inputName: video,
            mediaAction: is_playing ? "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY" : "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE"
        });
        if (is_playing) {
            obs_sync(obs);
        }
    }

    obs.call("SetCurrentProgramScene", {
        sceneName: is_playing ? "Scene" : "Waiting"
    })
};

const start = async () => {
    // Establishes a connection with Live
    await ableton.start();
    await obs.connect("ws://127.0.0.1:4455");

    // restart all videos
    obs_restart(obs)

    // stop any playback if we're not playing on launch
    const is_playing = await ableton.song.get("is_playing");
    obs_pause(is_playing, obs)

    // observe the current playback state
    ableton.song.addListener("is_playing", (is_playing) => obs_pause(is_playing, obs));

    // TODO: pause when Ableton stops, maybe via callback?
    // synchronise every 5 seconds
    setInterval(() => obs_sync(obs), 5000);
};

start();
