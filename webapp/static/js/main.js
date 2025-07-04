document.addEventListener('DOMContentLoaded', (event) => {
    const socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        // Optionally request initial state or wait for server to send it
        // socket.emit('request_initial_state');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });

    socket.on('message', (msg) => {
        console.log('Received message:', msg);
        // Could update a status area with general messages
    });

    socket.on('game_state_update', (state) => {
        console.log('Received game state update:', state);
        updateGameInfo(state);
        updateImpactTracks(state.impact_tracks);
        updatePlayerDashboards(state.players); // Assuming 'players' is part of the state
        updateGameLog(state.log);
    });

    function updateGameInfo(state) {
        document.getElementById('round-number').textContent = state.round_number || '--';
        document.getElementById('current-player').textContent = state.current_player_name || '--';
    }

    function updateImpactTracks(tracks) {
        const tracksList = document.getElementById('tracks-list');
        tracksList.innerHTML = ''; // Clear old tracks
        if (tracks) {
            for (const trackColor in tracks) {
                const track = tracks[trackColor];
                const listItem = document.createElement('li');
                listItem.textContent = `${track.name} (${trackColor}): ${track.level}/10`;
                tracksList.appendChild(listItem);
            }
        }
    }

    function updatePlayerDashboards(players) {
        const dashboardsDiv = document.getElementById('player-dashboards');
        dashboardsDiv.innerHTML = '<h2>Player Dashboards</h2>'; // Clear old, add title back
        if (players) {
            players.forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-dashboard';
                playerDiv.innerHTML = `
                    <h3>${player.name}</h3>
                    <p>CredCoin: ${player.cred_coin}</p>
                    <p>Reputation: ${player.reputation_stars}</p>
                    <p>Total Water: ${player.total_water_produced}</p>
                    <p>Facilities: ${player.facilities.map(f => f ? `${f.name} (Cost: ${f.cost})` : 'Empty').join('; ')}</p>
                    <p>Distribution: ${player.distribution_routes.map(r => r ? `${r.name} (Cost: ${r.cost})` : 'Empty').join('; ')}</p>
                    <p>R&D Techs: ${player.r_and_d && player.r_and_d.length > 0 ? player.r_and_d.map(tech => tech.name).join(', ') : 'None'}</p>
                    <p>Impact Storage: ${Object.entries(player.impact_storage || {}).filter(([k,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(', ') || 'Empty'}</p>
                    <p>Futures Tokens: ${player.futures_tokens && player.futures_tokens.length > 0 ? player.futures_tokens.join(', ') : 'None'}</p>
                    <p>Event Options: ${player.event_options && player.event_options.length > 0 ? player.event_options.join(', ') : 'None'}</p>
                `;
                if (player.water_batches && player.water_batches.length > 0) {
                    const batchesUl = document.createElement('ul');
                    batchesUl.className = 'water-batches';
                    batchesUl.innerHTML = '<strong>Water Batches:</strong>';
                    player.water_batches.forEach(batch => {
                        const batchLi = document.createElement('li');
                        batchLi.textContent = `${batch.quantity} from ${batch.facility_name} (μP: ${batch.base_impact_profile.PINK || 0}, CO₂e: ${batch.base_impact_profile.GREY || 0})`;
                        batchesUl.appendChild(batchLi);
                    });
                    playerDiv.appendChild(batchesUl);
                }
                dashboardsDiv.appendChild(playerDiv);
            });
        }
    }


    function updateGameLog(logEntries) {
        const logUl = document.getElementById('log-entries');
        logUl.innerHTML = ''; // Clear old log
        if (logEntries) {
            logEntries.forEach(entry => {
                const listItem = document.createElement('li');
                listItem.textContent = entry;
                logUl.appendChild(listItem);
            });
        }
    }

    // Store player ID assigned by server
    let myPlayerId = null;
    let myPlayerIndex = -1;

    socket.on('assign_player_id', (data) => {
        myPlayerId = data.playerId;
        myPlayerIndex = data.playerIndex;
        console.log(`Assigned Player ID: ${myPlayerId}, Index: ${myPlayerIndex}`);
        // Update UI to show who "you" are, if needed
        document.getElementById('actions').prepend(document.createTextNode(`You are: ${myPlayerId} (P${myPlayerIndex+1}) `));
    });

    // Example of sending an action (to be expanded in next step)
    const buildGlacialTapBtn = document.getElementById('build-glacial-tap-btn');
    if(buildGlacialTapBtn){
        buildGlacialTapBtn.addEventListener('click', () => {
            if (!myPlayerId) {
                alert("Player ID not assigned yet. Cannot perform action.");
                return;
            }
            console.log(`${myPlayerId} clicked Build Glacial Tap button`);
            const actionData = {
                action_type: 'build_facility',
                payload: { card_name: 'Glacial Tap', slot_index: 0 }
            };
            socket.emit('player_action', actionData);
        });
    }

    // Whim Draft Logic
    const startWhimDraftBtn = document.getElementById('start-whim-draft-btn');
    const whimDraftArea = document.getElementById('whim-draft-area');
    const whimDrafterNameSpan = document.getElementById('whim-drafter-name');
    const whimPickNumberSpan = document.getElementById('whim-pick-number');
    const whimOptionsList = document.getElementById('whim-options-list');
    const submitWhimChoiceBtn = document.getElementById('submit-whim-choice-btn');

    if (startWhimDraftBtn) {
        startWhimDraftBtn.addEventListener('click', () => {
            console.log('Start Whim Draft button clicked');
            socket.emit('start_whim_draft');
        });
    }

    socket.on('whim_draft_options', (data) => {
        console.log('Received whim_draft_options:', data);
        if (data.player_name === myPlayerId) {
            whimDrafterNameSpan.textContent = data.player_name;
            whimPickNumberSpan.textContent = data.pick_num;
            whimOptionsList.innerHTML = ''; // Clear previous options

            data.options.forEach((card, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <input type="radio" name="whim_choice" value="${index}" id="whim_opt_${index}">
                    <label for="whim_opt_${index}">${card.name} (Pre: ${card.description}, Post: ${card.cost})</label>
                `; // Using description and cost as placeholders for pre/post effects for now
                // Actual card object structure in JS will be: {name, description, cost} from serialize_card
                // WhimCard specific: name, trigger_condition, pre_round_effect, post_round_fallout
                // So, the label should be:
                // <label for="whim_opt_${index}">${card.name} (Trigger: ${card.trigger_condition}, Pre: ${card.pre_round_effect}, Post: ${card.post_round_fallout})</label>
                // For now, using what serialize_card provides. We need to enhance serialize_card for Whims.
                // For now, let's assume 'description' holds pre-round and 'cost' (as a placeholder) holds post-round for display.
                // A better approach is to have serialize_card be type-aware or have specific serializers.
                // For WhimCard, it should be card.name, card.trigger_condition, card.pre_round_effect, card.post_round_fallout
                // The current serialize_card sends: name, description, cost.
                // We need to update serialize_card to be more specific or pass more Whim data.
                // Let's assume for now `card.description` contains the key details for a Whim.
                // Corrected label based on typical WhimCard attributes (assuming serialize_card is updated for Whims)
                let cardDetailsText = `${card.name}`;
                if (card.card_type === 'WHIM') {
                    cardDetailsText += ` (Trigger: ${card.trigger_condition || 'N/A'}, Pre: ${card.pre_round_effect || 'N/A'}, Post: ${card.post_round_fallout || 'N/A'})`;
                } else {
                    cardDetailsText += ` - ${card.description || ''}`;
                }

                listItem.innerHTML = `
                    <input type="radio" name="whim_choice" value="${index}" id="whim_opt_${index}" ${index === 0 ? 'checked' : ''}>
                    <label for="whim_opt_${index}">${cardDetailsText}</label>
                `;

                whimOptionsList.appendChild(listItem);
            });
            whimDraftArea.style.display = 'block';
        } else {
            whimDraftArea.style.display = 'none'; // Hide if not this player's turn
        }
    });

    if (submitWhimChoiceBtn) {
        submitWhimChoiceBtn.addEventListener('click', () => {
            const selectedChoiceInput = document.querySelector('input[name="whim_choice"]:checked');
            if (selectedChoiceInput) {
                const chosenIndex = parseInt(selectedChoiceInput.value);
                console.log(`Submitting Whim choice, index: ${chosenIndex}`);
                socket.emit('submit_whim_draft_choice', { chosen_card_index: chosenIndex });
                whimDraftArea.style.display = 'none';
            } else {
                alert('Please select a Whim card.');
            }
        });
    }

    // Listen for end of draft to hide the area if it was somehow left open
    // (e.g. if another player finished the draft)
    // This can be part of game_state_update if whim_draft_active becomes false
    // (Already handled by game_state_update indirectly if it hides based on player turn)

});
