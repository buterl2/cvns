// This is a simplified approach focused on reliable synchronization
// Replace your script.js with this version

document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
    const firebaseConfig = {
        apiKey: "AIzaSyBZhaLwkyDjtIOCkAbFIDORAVpNP5SK0OY",
        authDomain: "planning-board-1ad74.firebaseapp.com",
        databaseURL: "https://planning-board-1ad74-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "planning-board-1ad74",
        storageBucket: "planning-board-1ad74.firebasestorage.app",
        messagingSenderId: "867603634354",
        appId: "1:867603634354:web:914c4a61c070cb828a51ab",
        measurementId: "G-EJ0085542E"
    };
    
    // After initializing Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Change this line
    const planningBoardRef = db.ref('planningBoard');
    // To this
    window.planningBoardRef = db.ref('planningBoard');

    // Keep the rest of your references the same
    const staffListRef = db.ref('planningBoard/staff');
    const positionsRef = db.ref('planningBoard/positions');
    
    // Elements
    const availableStaffContainer = document.getElementById('available-staff');
    const staffPool = document.querySelector('.staff-pool');
    const addStaffButton = document.getElementById('add-staff');
    const removeStaffButton = document.getElementById('remove-staff');
    const saveButton = document.getElementById('save-board');
    const resetButton = document.getElementById('reset-board');
    const modal = document.getElementById('add-staff-modal');
    const closeButton = document.querySelector('.close-button');
    const newStaffForm = document.getElementById('new-staff-form');
    const allDropZones = document.querySelectorAll('.staff-dropzone');
    const floorToggles = document.querySelectorAll('.floor-toggle');
    
    // Connection status elements
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    // Add Support button
    const addSupportButton = document.createElement('button');
    addSupportButton.id = 'add-support';
    addSupportButton.textContent = 'Add Support';
    document.querySelector('.controls').appendChild(addSupportButton);
    
    // Track removal mode
    let removalMode = false;
    
    // Local tracking of staff and positions
    let staffList = [];
    let positions = {};
    
    // Initialize
    init();
    
    function init() {
        console.log('Initializing planning board...');
        
        // Show connecting status
        updateConnectionStatus('connecting', 'Connecting...');
        
        // Set up connection monitoring
        setupConnectionMonitoring();

        normalizeDatabase();

        availableStaffContainer.innerHTML = '';
        
        // Clear all containers to start fresh
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Set up event listeners for UI interactions
        setupEventListeners();
        
        // Set up drag and drop
        setupDragAndDrop();
        
        // Load initial data and set up realtime listeners
        loadInitialData();
    }
    
    function setupConnectionMonitoring() {
        const connectedRef = firebase.database().ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                console.log('Connected to Firebase');
                updateConnectionStatus('online', 'Online');
            } else {
                console.log('Disconnected from Firebase');
                updateConnectionStatus('offline', 'Offline');
            }
        });
    }

    function normalizeDatabase() {
        console.log('Normalizing database structure...');
        updateConnectionStatus('syncing', 'Fixing database structure...');
        
        planningBoardRef.once('value')
            .then(snapshot => {
                if (!snapshot.exists()) return;
                
                const data = snapshot.val();
                const updates = {};
                let needsUpdate = false;
                
                // Make sure we have a positions object
                if (!data.positions) {
                    updates.positions = {};
                    needsUpdate = true;
                }
                
                // Check all positions and ensure they use arrays
                if (data.positions) {
                    Object.keys(data.positions).forEach(positionId => {
                        const posValue = data.positions[positionId];
                        
                        // If it's a string (single ID), convert to array
                        if (typeof posValue === 'string') {
                            updates[`positions/${positionId}`] = [posValue];
                            needsUpdate = true;
                        } 
                        // If it's null or undefined, set empty array
                        else if (posValue === null || posValue === undefined) {
                            updates[`positions/${positionId}`] = [];
                            needsUpdate = true;
                        }
                        // If it's anything else but not an array, set empty array
                        else if (!Array.isArray(posValue)) {
                            updates[`positions/${positionId}`] = [];
                            needsUpdate = true;
                        }
                    });
                }
                
                // If we need to update the database
                if (needsUpdate) {
                    planningBoardRef.update(updates)
                        .then(() => {
                            console.log('Database structure normalized successfully');
                            updateConnectionStatus('online', 'Database Fixed');
                        })
                        .catch(error => {
                            console.error('Error normalizing database:', error);
                            updateConnectionStatus('error', 'Fix Failed');
                        });
                } else {
                    console.log('Database structure already normalized');
                    updateConnectionStatus('online', 'Database OK');
                }
            })
            .catch(error => {
                console.error('Error checking database structure:', error);
                updateConnectionStatus('error', 'Check Failed');
            });
    }
    
    function updateConnectionStatus(status, message) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (!statusIndicator || !statusText) {
            console.warn('Status indicator elements not found');
            return;
        }
        
        // Remove all status classes
        statusIndicator.classList.remove('online', 'offline', 'connecting', 'syncing', 'error');
        
        // Add the appropriate class
        statusIndicator.classList.add(status);
        statusText.textContent = message;
    }

    // Make sure our saveToFirebase function preserves positions
    function saveToFirebase() {
        updateConnectionStatus('syncing', 'Saving...');
        
        // First get the current positions
        planningBoardRef.child('positions').once('value')
            .then(snapshot => {
                const currentPositions = snapshot.exists() ? snapshot.val() : {};
                
                // Build the planning data
                const planningData = {
                    timestamp: Date.now(),
                    staff: []
                };
                
                // Save all staff in the pool
                availableStaffContainer.querySelectorAll('.staff-card').forEach(card => {
                    const id = card.getAttribute('data-id');
                    const name = card.querySelector('.staff-name').textContent;
                    const photoSrc = card.querySelector('img').src;
                    
                    planningData.staff.push({
                        id: id,
                        name: name,
                        photo: photoSrc
                    });
                });
                
                // Add staff from positions
                document.querySelectorAll('.staff-dropzone .staff-card').forEach(card => {
                    const id = card.getAttribute('data-id');
                    const name = card.querySelector('.staff-name').textContent;
                    const photoSrc = card.querySelector('img').src;
                    
                    // Only add if not already in the list
                    if (!planningData.staff.some(s => s.id === id)) {
                        planningData.staff.push({
                            id: id,
                            name: name,
                            photo: photoSrc
                        });
                    }
                });
                
                // Set new positions based on current DOM state
                const newPositions = {};
                allDropZones.forEach(zone => {
                    const positionSlot = zone.closest('.position-slot');
                    if (!positionSlot) return;
                    
                    const positionId = positionSlot.getAttribute('data-position');
                    const staffCards = zone.querySelectorAll('.staff-card');
                    
                    if (staffCards.length > 0) {
                        newPositions[positionId] = Array.from(staffCards).map(card => 
                            card.getAttribute('data-id')
                        );
                    } else {
                        // Maintain empty arrays for empty positions
                        newPositions[positionId] = [];
                    }
                });
                
                // Preserve any positions not in the DOM
                for (const positionId in currentPositions) {
                    if (!newPositions.hasOwnProperty(positionId)) {
                        newPositions[positionId] = currentPositions[positionId];
                    }
                }
                
                // Set the positions
                planningData.positions = newPositions;
                
                // Save to Firebase
                return planningBoardRef.set(planningData);
            })
            .then(() => {
                console.log('Board saved successfully to Firebase');
                updateConnectionStatus('online', 'Saved');
            })
            .catch(error => {
                console.error('Error saving to Firebase:', error);
                updateConnectionStatus('error', 'Save Error');
            });
    }
    
    function loadInitialData() {
        // Load staff list
        staffListRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Found existing staff data');
                    staffList = snapshot.val() || [];
                } else {
                    console.log('No existing staff data, using sample data');
                    // Sample staff data
                    staffList = [
                        { id: 'sample1', name: 'John Doe', photo: 'placeholder-photo.jpg' },
                        { id: 'sample2', name: 'Jane Smith', photo: 'placeholder-photo.jpg' },
                        { id: 'sample3', name: 'Mike Johnson', photo: 'placeholder-photo.jpg' },
                        { id: 'sample4', name: 'Sarah Williams', photo: 'placeholder-photo.jpg' },
                        { id: 'sample5', name: 'David Brown', photo: 'placeholder-photo.jpg' }
                    ];
                    // Save sample data
                    staffListRef.set(staffList);
                }
                
                // Load positions data
                return positionsRef.once('value');
            })
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Found existing positions data');
                    positions = snapshot.val() || {};
                } else {
                    console.log('No existing positions data');
                    positions = {};
                    // Save empty positions
                    positionsRef.set(positions);
                }
                
                // Now that we have both staff and positions, render the board
                renderBoard();
                
                // Set up realtime listeners for ongoing changes
                setupRealtimeListeners();
                
                console.log('Initialization complete');
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                updateConnectionStatus('error', 'Data Load Error');
            });
    }
    
    function setupRealtimeListeners() {
        // Listen for staff changes
        staffListRef.on('value', snapshot => {
            console.log('Staff list updated in Firebase');
            staffList = snapshot.val() || [];
            renderStaffList();
        });
        
        // Listen for position changes
        positionsRef.on('value', snapshot => {
            console.log('Positions updated in Firebase');
            positions = snapshot.val() || {};
            renderPositions();
        });
    }
    
    function renderBoard() {
        // Clear everything first
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Render staff and positions
        renderStaffList();
        renderPositions();
    }
    
    function renderStaffList() {
        // First collect all staff IDs that are in positions
        const placedStaffIds = [];
        for (const positionId in positions) {
            if (positions[positionId] && Array.isArray(positions[positionId])) {
                positions[positionId].forEach(staffId => {
                    placedStaffIds.push(staffId);
                });
            }
        }
        
        // Clear the available staff container
        availableStaffContainer.innerHTML = '';
        
        // Add staff that are not in positions to the available pool
        staffList.forEach(staff => {
            if (!placedStaffIds.includes(staff.id)) {
                createStaffCard(staff.id, staff.name, staff.photo);
            }
        });
    }
    
    function renderPositions() {
        // For each position, clear it and then add the assigned staff
        allDropZones.forEach(zone => {
            const positionSlot = zone.closest('.position-slot');
            if (!positionSlot) return;
            
            const positionId = positionSlot.getAttribute('data-position');
            
            // Clear the zone
            zone.innerHTML = '';
            
            // If there are staff assigned to this position
            if (positions[positionId] && Array.isArray(positions[positionId])) {
                positions[positionId].forEach(staffId => {
                    // Find the staff data
                    const staffData = staffList.find(s => s.id === staffId);
                    if (staffData) {
                        // Create the staff card
                        const staffCard = document.createElement('div');
                        staffCard.className = 'staff-card';
                        staffCard.setAttribute('draggable', 'true');
                        staffCard.setAttribute('data-id', staffId);
                        
                        staffCard.innerHTML = `
                            <div class="staff-photo">
                                <img src="${staffData.photo}" alt="${staffData.name}">
                            </div>
                            <div class="staff-info">
                                <p class="staff-name">${staffData.name}</p>
                            </div>
                        `;
                        
                        // Add to the zone
                        zone.appendChild(staffCard);
                        
                        // Setup drag events
                        setupDragEventsForElement(staffCard);
                    }
                });
            }
            
            // Equalize heights in rows
            equalizeHeightsInRow(zone);
        });
        
        // Re-setup drag and drop
        setupDragAndDrop();
    }
    
    function setupEventListeners() {
        // Add staff button
        addStaffButton.addEventListener('click', () => {
            modal.style.display = 'block';
        });
        
        // Add support button
        addSupportButton.addEventListener('click', () => {
            const supportName = prompt('Enter support name:');
            if (supportName && supportName.trim() !== '') {
                addNewStaff('support-' + Date.now(), supportName.trim(), createPlaceholderImage());
            }
        });
        
        // Remove staff button
        removeStaffButton.addEventListener('click', toggleRemovalMode);
        
        // Close modal
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Add new staff form
        newStaffForm.addEventListener('submit', handleNewStaffSubmit);
        
        // Save board button (for manual save)
        saveButton.addEventListener('click', () => {
            saveBoardState();
        });
        
        // Reset board
        resetButton.addEventListener('click', confirmReset);
        
        // Floor toggle buttons
        floorToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                const floor = this.closest('.floor');
                floor.classList.toggle('collapsed');
                this.textContent = floor.classList.contains('collapsed') ? '+' : '−';
                e.stopPropagation();
            });
        });
    }
    
    function toggleRemovalMode() {
        removalMode = !removalMode;
        
        if (removalMode) {
            removeStaffButton.classList.add('active');
            removeStaffButton.textContent = 'Cancel Removal';
            document.body.classList.add('removal-mode');
            
            // Add click events for removal
            document.querySelectorAll('.staff-card').forEach(card => {
                card.classList.add('removable');
                card.addEventListener('click', removeStaffCard);
            });
        } else {
            removeStaffButton.classList.remove('active');
            removeStaffButton.textContent = 'Remove Staff';
            document.body.classList.remove('removal-mode');
            
            // Remove click events
            document.querySelectorAll('.staff-card').forEach(card => {
                card.classList.remove('removable');
                card.removeEventListener('click', removeStaffCard);
            });
        }
    }
    
    function removeStaffCard(e) {
        if (removalMode) {
            const card = e.currentTarget;
            const staffId = card.getAttribute('data-id');
            
            // Remove the staff from our staff list
            const staffIndex = staffList.findIndex(s => s.id === staffId);
            if (staffIndex !== -1) {
                staffList.splice(staffIndex, 1);
                staffListRef.set(staffList);
                
                // Also remove from any positions
                for (const positionId in positions) {
                    if (positions[positionId] && Array.isArray(positions[positionId])) {
                        const staffIndex = positions[positionId].indexOf(staffId);
                        if (staffIndex !== -1) {
                            positions[positionId].splice(staffIndex, 1);
                            if (positions[positionId].length === 0) {
                                // If position is empty, set to empty array explicitly
                                positions[positionId] = [];
                            }
                        }
                    }
                }
                positionsRef.set(positions);
            }
            
            card.remove();
        }
    }
    
    function handleNewStaffSubmit(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById('staff-name');
        const photoInput = document.getElementById('staff-photo');
        
        const name = nameInput.value.trim();
        let photoSrc = 'placeholder-photo.jpg'; // Default photo
        
        // Handle photo upload
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                photoSrc = e.target.result;
                addNewStaff('staff-' + Date.now(), name, photoSrc);
                
                // Reset form and close modal
                nameInput.value = '';
                photoInput.value = '';
                modal.style.display = 'none';
            };
            
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            photoSrc = createPlaceholderImage();
            addNewStaff('staff-' + Date.now(), name, photoSrc);
            
            // Reset form and close modal
            nameInput.value = '';
            photoInput.value = '';
            modal.style.display = 'none';
        }
    }
    
    function addNewStaff(id, name, photoSrc) {
        // Add to our staff list
        updateConnectionStatus('syncing', 'Adding new staff...');
        
        // First get the current staff list
        planningBoardRef.child('staff').once('value')
            .then(snapshot => {
                let staffList = [];
                if (snapshot.exists()) {
                    staffList = snapshot.val() || [];
                }
                
                // Add the new staff to the list
                staffList.push({
                    id: id,
                    name: name,
                    photo: photoSrc
                });
                
                // Update only the staff array, not the whole board
                return planningBoardRef.child('staff').set(staffList);
            })
            .then(() => {
                console.log('Staff added successfully');
                updateConnectionStatus('online', 'Staff Added');
            })
            .catch(error => {
                console.error('Error adding staff:', error);
                updateConnectionStatus('error', 'Add Failed');
            });
    }
    
    // Create a placeholder image with MDT text
    function createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        
        const ctx = canvas.getContext('2d');
        
        // Draw blue circle
        ctx.fillStyle = '#0057B8'; // Medtronic blue
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Add MDT text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MDT', 50, 50);
        
        return canvas.toDataURL('image/png');
    }
    
    function createStaffCard(id, name, photoSrc) {
        // If photoSrc is the default placeholder, replace with our custom one
        if (photoSrc === 'placeholder-photo.jpg') {
            photoSrc = createPlaceholderImage();
        }
        
        const staffCard = document.createElement('div');
        staffCard.className = 'staff-card';
        staffCard.setAttribute('draggable', 'true');
        staffCard.setAttribute('data-id', id);
        
        staffCard.innerHTML = `
            <div class="staff-photo">
                <img src="${photoSrc}" alt="${name}">
            </div>
            <div class="staff-info">
                <p class="staff-name">${name}</p>
            </div>
        `;
        
        // Add to staff pool
        availableStaffContainer.appendChild(staffCard);
        
        // Set up drag events for the new card
        setupDragEventsForElement(staffCard);
        
        // Register for removal if in removal mode
        if (removalMode) {
            registerForRemoval(staffCard);
        }
    }
    
    // Register a staff card for removal mode if it's active
    function registerForRemoval(card) {
        card.classList.add('removable');
        card.addEventListener('click', removeStaffCard);
    }
    
    function setupDragEventsForElement(element) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', element.getAttribute('data-id'));
            element.classList.add('dragging');
            
            // If this card is in a dropzone, temporarily add a placeholder
            const parentDropzone = element.closest('.staff-dropzone');
            if (parentDropzone) {
                // Create placeholder to maintain dropzone height
                const placeholder = document.createElement('div');
                placeholder.className = 'staff-placeholder';
                placeholder.style.height = `${element.offsetHeight}px`;
                parentDropzone.appendChild(placeholder);
            }
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            
            // Remove any placeholders
            document.querySelectorAll('.staff-placeholder').forEach(ph => ph.remove());
        });
    }
    
    function setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('highlight');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('highlight');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('highlight');
            
            const staffId = e.dataTransfer.getData('text/plain');
            const staffCard = document.querySelector(`[data-id="${staffId}"]`);
            
            if (staffCard) {
                // Get the position ID
                const positionSlot = zone.closest('.position-slot');
                if (!positionSlot) return;
                
                const positionId = positionSlot.getAttribute('data-position');
                
                // First, remove this staff from any positions it might be in
                const updates = {};
                planningBoardRef.child('positions').once('value', snapshot => {
                    if (snapshot.exists()) {
                        snapshot.forEach(positionSnapshot => {
                            const posKey = positionSnapshot.key;
                            const posValue = positionSnapshot.val();
                            
                            // If this position has this staff, remove it
                            if (Array.isArray(posValue) && posValue.includes(staffId)) {
                                const newPosValue = posValue.filter(id => id !== staffId);
                                updates[`positions/${posKey}`] = newPosValue;
                            } else if (posValue === staffId) {
                                // Handle the case where position has a single ID string
                                updates[`positions/${posKey}`] = [];
                            }
                        });
                    }
                    
                    // Now add the staff to the new position
                    planningBoardRef.child(`positions/${positionId}`).once('value', posSnapshot => {
                        if (posSnapshot.exists()) {
                            const currentValue = posSnapshot.val();
                            if (Array.isArray(currentValue)) {
                                // If it's already an array, add the staff ID
                                if (!currentValue.includes(staffId)) {
                                    updates[`positions/${positionId}`] = [...currentValue, staffId];
                                }
                            } else if (typeof currentValue === 'string') {
                                // If it's a string (single ID), convert to array
                                if (currentValue !== staffId) {
                                    updates[`positions/${positionId}`] = [currentValue, staffId];
                                }
                            } else {
                                // Otherwise, just set a new array
                                updates[`positions/${positionId}`] = [staffId];
                            }
                        } else {
                            // Position doesn't exist yet, create it as an array
                            updates[`positions/${positionId}`] = [staffId];
                        }
                        
                        // Apply all the updates in a single transaction
                        if (Object.keys(updates).length > 0) {
                            updateConnectionStatus('syncing', 'Updating positions...');
                            planningBoardRef.update(updates)
                                .then(() => {
                                    console.log('Positions updated successfully');
                                    updateConnectionStatus('online', 'Saved');
                                    
                                    // Add staff card to the dropzone (local update for immediate feedback)
                                    staffCard.parentNode.removeChild(staffCard);
                                    zone.appendChild(staffCard);
                                    
                                    // Animation effect
                                    staffCard.classList.add('dropped');
                                    setTimeout(() => {
                                        staffCard.classList.remove('dropped');
                                    }, 300);
                                    
                                    // Equalize heights in the same row
                                    equalizeHeightsInRow(zone);
                                })
                                .catch(error => {
                                    console.error('Error updating positions:', error);
                                    updateConnectionStatus('error', 'Update Error');
                                });
                        }
                    });
                });
            }
        });
    }

    function populateFromSavedData(data) {
        console.log('Populating from Firebase data:', data);
        
        // If there's no staff data, keep existing staff
        if (!data.staff || !Array.isArray(data.staff)) {
            console.warn('No staff data found or invalid format, skipping staff update');
        } else {
            // First, cache all existing staff cards by their IDs
            const existingStaffCards = {};
            document.querySelectorAll('.staff-card').forEach(card => {
                const id = card.getAttribute('data-id');
                existingStaffCards[id] = card;
            });
            
            // Clear the staff pool
            availableStaffContainer.innerHTML = '';
            
            // Track which staff members are placed in positions
            const placedStaffIds = new Set();
            
            // If we have position data, process it to find placed staff
            if (data.positions) {
                Object.keys(data.positions).forEach(positionId => {
                    const posValue = data.positions[positionId];
                    if (Array.isArray(posValue)) {
                        posValue.forEach(staffId => placedStaffIds.add(staffId));
                    } else if (typeof posValue === 'string') {
                        placedStaffIds.add(posValue);
                    }
                });
            }
            
            // Add staff that aren't placed in positions to the pool
            data.staff.forEach(staff => {
                if (!placedStaffIds.has(staff.id)) {
                    // If we have an existing card, reuse it, otherwise create new
                    if (existingStaffCards[staff.id]) {
                        availableStaffContainer.appendChild(existingStaffCards[staff.id]);
                        delete existingStaffCards[staff.id];
                    } else {
                        createStaffCard(staff.id, staff.name, staff.photo);
                    }
                }
            });
        }
        
        // Handle position assignments
        if (data.positions) {
            document.querySelectorAll('.staff-dropzone').forEach(zone => {
                const positionSlot = zone.closest('.position-slot');
                if (!positionSlot) return;
                
                const positionId = positionSlot.getAttribute('data-position');
                const positionData = data.positions[positionId];
                
                // Clear the zone first
                zone.innerHTML = '';
                
                // If this position has assigned staff
                if (positionData) {
                    // Convert to array for consistent handling
                    const staffIds = Array.isArray(positionData) ? positionData : [positionData];
                    
                    staffIds.forEach(staffId => {
                        // Find staff data
                        const staffData = data.staff ? data.staff.find(s => s.id === staffId) : null;
                        
                        if (staffData) {
                            // Create or reuse the staff card
                            let staffCard;
                            const existingCard = document.querySelector(`[data-id="${staffId}"]`);
                            
                            if (existingCard) {
                                staffCard = existingCard.cloneNode(true);
                            } else {
                                staffCard = document.createElement('div');
                                staffCard.className = 'staff-card';
                                staffCard.setAttribute('draggable', 'true');
                                staffCard.setAttribute('data-id', staffId);
                                
                                staffCard.innerHTML = `
                                    <div class="staff-photo">
                                        <img src="${staffData.photo}" alt="${staffData.name}">
                                    </div>
                                    <div class="staff-info">
                                        <p class="staff-name">${staffData.name}</p>
                                    </div>
                                `;
                            }
                            
                            // Add to this position and setup drag events
                            zone.appendChild(staffCard);
                            setupDragEventsForElement(staffCard);
                        }
                    });
                }
                
                // Update the heights for this row
                equalizeHeightsInRow(zone);
            });
        }
        
        // Re-attach drag events to all cards
        setupDragAndDrop();
    }
    
    // Make staff pool a valid dropzone for returning operators
    function setupStaffPoolAsDropZone() {
        [staffPool, availableStaffContainer].forEach(element => {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                staffPool.classList.add('highlight');
            });
            
            element.addEventListener('dragleave', () => {
                staffPool.classList.remove('highlight');
            });
            
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                staffPool.classList.remove('highlight');
                
                const staffId = e.dataTransfer.getData('text/plain');
                const staffCard = document.querySelector(`[data-id="${staffId}"]`);
                
                if (staffCard) {
                    // Remove this staff from any positions it might be in
                    const updates = {};
                    planningBoardRef.child('positions').once('value', snapshot => {
                        let positionUpdated = false;
                        
                        if (snapshot.exists()) {
                            snapshot.forEach(positionSnapshot => {
                                const posKey = positionSnapshot.key;
                                const posValue = positionSnapshot.val();
                                
                                // If this position has this staff, remove it
                                if (Array.isArray(posValue) && posValue.includes(staffId)) {
                                    const newPosValue = posValue.filter(id => id !== staffId);
                                    updates[`positions/${posKey}`] = newPosValue;
                                    positionUpdated = true;
                                } else if (posValue === staffId) {
                                    // Handle the case where position has a single ID string
                                    updates[`positions/${posKey}`] = [];
                                    positionUpdated = true;
                                }
                            });
                        }
                        
                        // Only update Firebase if we actually modified a position
                        if (positionUpdated) {
                            updateConnectionStatus('syncing', 'Updating positions...');
                            planningBoardRef.update(updates)
                                .then(() => {
                                    console.log('Staff returned to pool successfully');
                                    updateConnectionStatus('online', 'Saved');
                                })
                                .catch(error => {
                                    console.error('Error returning staff to pool:', error);
                                    updateConnectionStatus('error', 'Update Error');
                                });
                        }
                        
                        // Move the card back to the staff pool in the local UI
                        staffCard.parentNode.removeChild(staffCard);
                        availableStaffContainer.appendChild(staffCard);
                    });
                }
            });
        });
    }
    
    // Only equalize heights of positions in the same visual row
    function equalizeHeightsInRow(zone) {
        // Find the position slot this zone belongs to
        const positionSlot = zone.closest('.position-slot');
        if (!positionSlot) return;
        
        const container = positionSlot.parentElement;
        const allPositionSlots = Array.from(container.querySelectorAll('.position-slot'));
        
        // Get the vertical position of this slot
        const rect = positionSlot.getBoundingClientRect();
        const thisTop = rect.top;
        
        // Find all slots in the same visual row (with the same or very close top position)
        const tolerance = 10; // 10px tolerance for slight misalignments
        const sameRowSlots = allPositionSlots.filter(slot => {
            const slotRect = slot.getBoundingClientRect();
            return Math.abs(slotRect.top - thisTop) <= tolerance;
        });
        
        // Get dropzones in these slots
        const dropzonesInRow = sameRowSlots.map(slot => slot.querySelector('.staff-dropzone'));
        
        // Reset heights first
        dropzonesInRow.forEach(dz => {
            if (dz) dz.style.height = 'auto';
        });
        
        // Wait for the DOM to update
        setTimeout(() => {
            // Find the tallest dropzone
            const heights = dropzonesInRow.map(dz => dz ? dz.offsetHeight : 0);
            const maxHeight = Math.max(...heights);
            
            // Set all dropzones to the tallest height
            dropzonesInRow.forEach(dz => {
                if (dz) dz.style.height = maxHeight + 'px';
            });
        }, 10);
    }
    
    function saveBoardState() {
        // This is a manual save function, useful as a fallback
        // Update Firebase
        updateConnectionStatus('syncing', 'Saving...');
        
        // Create a transaction to update both staff and positions together
        const updates = {};
        updates['planningBoard/staff'] = staffList;
        updates['planningBoard/positions'] = positions;
        
        firebase.database().ref().update(updates)
            .then(() => {
                console.log('Board saved successfully to Firebase');
                updateConnectionStatus('online', 'Saved');
            })
            .catch(error => {
                console.error('Error saving to Firebase:', error);
                updateConnectionStatus('error', 'Save Error');
            });
    }
    
    function confirmReset() {
        if (confirm('Are you sure you want to reset the planning board? All assignments will be cleared.')) {
            resetBoard();
        }
    }
    
    function resetBoard() {
        // Reset all positions to empty arrays
        for (const positionId in positions) {
            positions[positionId] = [];
        }
        
        // Save to Firebase
        updateConnectionStatus('syncing', 'Resetting...');
        positionsRef.set(positions)
            .then(() => {
                console.log('Board reset successfully');
                updateConnectionStatus('online', 'Reset Complete');
            })
            .catch(error => {
                console.error('Error resetting board:', error);
                updateConnectionStatus('error', 'Reset Error');
            });
    }
    
    function setupDragAndDrop() {
        // Set up drag events for all existing staff cards
        document.querySelectorAll('.staff-card').forEach(card => {
            setupDragEventsForElement(card);
        });
        
        // Set up drop events for all dropzones
        allDropZones.forEach(zone => {
            setupDropZone(zone);
        });
        
        // Make staff pool a valid dropzone
        setupStaffPoolAsDropZone();
        
        // Initialize heights for all rows
        document.querySelectorAll('.positions-container').forEach(container => {
            const firstDropzone = container.querySelector('.staff-dropzone');
            if (firstDropzone) {
                equalizeHeightsInRow(firstDropzone);
            }
        });
    }
});