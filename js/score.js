/**
 * score.js
 * Server-derived SDG 12 score (joins + created challenges + pledges).
 */

window.userScore = 0;

window.updateGlobalScore = function () {
    const desktopDisplay = document.getElementById('user-score-display');
    const mobileDisplay = document.getElementById('mobile-user-score');

    if (desktopDisplay) desktopDisplay.textContent = `${window.userScore} Poin`;
    if (mobileDisplay) mobileDisplay.textContent = `${window.userScore} Poin`;
};

window.refreshScore = async function () {
    try {
        const householdId = await window.getHouseholdId();
        const score = await window.api(`/api/households/${householdId}/score`);
        window.userScore = score.total;
        window.updateGlobalScore();
        return score;
    } catch (error) {
        console.warn('Score refresh failed:', error.message);
        return null;
    }
};

window.updateGlobalScore();
window.refreshScore();
