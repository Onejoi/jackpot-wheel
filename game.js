document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Context
    const canvas = document.getElementById('wheel-canvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const potDisplay = document.getElementById('pot-amount');
    const timerDisplay = document.getElementById('timer');
    const playersList = document.getElementById('players-list');
    const betButtons = document.querySelectorAll('.bet-btn');
    const wheelElement = document.getElementById('wheel-canvas');

    // Game State
    let players = [
        { name: '@crypto_king', bet: 50.0, color: '#ef4444' }, // Red
        { name: '@lucky_guy', bet: 25.5, color: '#3b82f6' },  // Blue
        { name: '@whale_alert', bet: 15.0, color: '#f59e0b' }, // Orange
        { name: '@newbie', bet: 5.0, color: '#8b5cf6' }       // Purple
    ];

    let myBet = 0;
    let roundTime = 45;
    let isSpinning = false;
    let currentRotation = -90; // Start at top

    // Colors
    const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#6366f1'];

    // --- INITIALIZATION ---
    function init() {
        resizeCanvas();
        updateGameState();
        startTimer();

        // Telegram WebApp expansion
        window.Telegram.WebApp.expand();
    }

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }

    // --- CORE LOGIC ---
    function getTotalPot() {
        return players.reduce((sum, p) => sum + p.bet, 0);
    }

    function updateGameState() {
        const total = getTotalPot();
        potDisplay.textContent = total.toFixed(2);

        drawWheel(total);
        updateFeed(total);
    }

    function drawWheel(total) {
        const centerX = canvas.width / (2 * window.devicePixelRatio);
        const centerY = canvas.height / (2 * window.devicePixelRatio);
        const radius = centerX; // Full width

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let startAngle = 0; // 0 is exactly 3 o'clock in Canvas

        // We want the visual start to be at the top (-90deg), handled by CSS rotation initially

        players.forEach(player => {
            const sliceAngle = (player.bet / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();

            ctx.fillStyle = player.color;
            ctx.fill();

            // Stroke for separation
            ctx.strokeStyle = '#18191c';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle += sliceAngle;
        });
    }

    function updateFeed(total) {
        playersList.innerHTML = '';

        // Sort by bet size (descending) like GTA
        const sortedPlayers = [...players].sort((a, b) => b.bet - a.bet);

        sortedPlayers.forEach(player => {
            const percent = ((player.bet / total) * 100).toFixed(1);

            const div = document.createElement('div');
            div.className = 'player-row';
            div.innerHTML = `
                <div class="player-color" style="background: ${player.color};"></div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-bet">${player.bet.toFixed(2)} USDT</div>
                </div>
                <div class="player-percent">${percent}%</div>
            `;

            playersList.appendChild(div);
        });
    }

    // --- INTERACTION ---
    betButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSpinning) return;

            const amountStr = btn.dataset.amount;
            let amount = 0;

            if (amountStr === 'max') amount = 10; // Demo limit
            else amount = parseFloat(amountStr);

            placeBet(amount);
        });
    });

    function placeBet(amount) {
        // Commission Logic (5% Entry Fee)
        const COMMISSION_RATE = 0.05;
        const fee = amount * COMMISSION_RATE;
        const netAmount = amount - fee;

        // Check if I already bet
        const myPlayerIndex = players.findIndex(p => p.name === '@you');

        if (myPlayerIndex >= 0) {
            players[myPlayerIndex].bet += netAmount;
        } else {
            players.push({
                name: '@you',
                bet: netAmount,
                color: '#10b981' // Green for user
            });
        }

        // Visual Feedback for Fee
        betButtons.forEach(btn => {
            if (parseFloat(btn.dataset.amount) === amount) {
                const originalText = btn.textContent;
                btn.textContent = `-${fee.toFixed(2)} FEE`;
                btn.style.color = '#ef4444';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.color = '';
                }, 1000);
            }
        });

        // Simulate "Waiting for payment" visually (removed for speed demo)
        // In real app: tg.sendData(...) -> Bot Invoice -> Payment confirmed -> Websocket push -> HERE

        updateGameState();

        // Haptic
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    // --- TIMER & SPIN ---
    function startTimer() {
        const interval = setInterval(() => {
            if (roundTime > 0 && !isSpinning) {
                roundTime--;
                // Format MM:SS
                const mins = Math.floor(roundTime / 60);
                const secs = roundTime % 60;
                timerDisplay.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

                // Add random bets to simulate activity
                if (Math.random() > 0.8) simulateRandomBet();

            } else if (roundTime <= 0 && !isSpinning) {
                clearInterval(interval);
                spinWheel();
            }
        }, 1000);
    }

    function simulateRandomBet() {
        const randomPlayer = players[Math.floor(Math.random() * (players.length - 1))]; // Don't pick @you if last
        if (randomPlayer.name !== '@you') {
            randomPlayer.bet += Math.floor(Math.random() * 5) + 0.5;
            updateGameState();
        }
    }

    function spinWheel() {
        isSpinning = true;
        timerDisplay.textContent = "ROLLING...";
        timerDisplay.style.color = "#fbbf24";

        const total = getTotalPot();
        const winningTicket = Math.random() * total;

        // Find winner
        let accumulated = 0;
        let winner = null;
        let winnerAngleEnd = 0;
        let winnerAngleStart = 0;

        for (let p of players) {
            const betVal = p.bet;
            if (winningTicket >= accumulated && winningTicket < accumulated + betVal) {
                winner = p;
                winnerAngleStart = (accumulated / total) * 360; // Degrees
                winnerAngleEnd = ((accumulated + betVal) / total) * 360;
                break;
            }
            accumulated += betVal;
        }

        // Calculate Target Rotation
        // The pointer is at TOP (270 degrees or -90 degrees in CSS)
        // We need the winning sector to center on the TOP.
        // Canvas draws from 0 (3 o'clock).
        // Let's rely on visual alignment.

        // Center of winning wedge in degrees (0-360)
        const winningCenter = (winnerAngleStart + winnerAngleEnd) / 2;

        // We want this "winningCenter" to end up at -90deg (Top).
        // Current CSS rotation is -90deg.
        // Delta = Target - Current.

        // Spin calculation: 
        // 5 full spins (1800 deg) + adjustment to make winningCenter align with pointer.
        // The wheel rotates CLOCKWISE (positive deg).
        // To bring a specific angle to the top pointer (-90 or 270):
        // FinalRotation = 360 - winningCenter - 90; (This is getting complex physics-wise due to canvas coord system)

        // Simplified Logic: 
        // Just rotate extra revolutions minus the angle of the winner.
        const extraSpins = 360 * 5;
        const targetRotation = extraSpins + (360 - winningCenter) - 90; // -90 to align 0 start to 3 oclock vs 12 oclock pointer? 
        // Trial and error alignment: 
        // Canvas 0 is East. CSS -90 puts East at North.
        // So 0 deg on canvas is under the pointer initially.
        // To get angle X under the pointer, we rotate -X degrees.
        // Since we rotate clockwise, we rotate (360 - X).

        const finalTransform = `rotate(${targetRotation}deg)`;

        wheelElement.style.transition = "transform 6s cubic-bezier(0.15, 0, 0.15, 1)"; // GTA easing
        wheelElement.style.transform = finalTransform;

        // Result Callback
        setTimeout(() => {
            showWinner(winner);
        }, 6500);
    }

    function showWinner(winner) {
        timerDisplay.textContent = "WINNER!";
        timerDisplay.style.color = "#10b981"; // Green

        // Highlight winner in list
        const rows = document.querySelectorAll('.player-row');
        rows.forEach(row => {
            if (row.innerText.includes(winner.name)) {
                row.style.background = "rgba(16, 185, 129, 0.2)";
                row.style.border = "1px solid #10b981";
            } else {
                row.style.opacity = "0.5";
            }
        });

        // Restart logic would go here
        setTimeout(() => {
            // alert(`Winner: ${winner.name} won ${getTotalPot().toFixed(2)} TON!`);
        }, 1000);
    }

    // Start
    init();
});
