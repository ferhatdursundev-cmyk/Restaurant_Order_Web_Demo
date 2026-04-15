
export const playOrderAlarm = async () => {
    try {
        const audio = new Audio("/order_alarm.mp3");

        audio.currentTime = 0;
        await audio.play();
    } catch (err) {
        console.error("Alarm sesi çalınamadı:", err);
    }
};