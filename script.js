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
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const planningBoardRef = db.ref('planningBoard');
    
    // Connection status elements
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
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
    
    // Add Support button
    const addSupportButton = document.createElement('button');
    addSupportButton.id = 'add-support';
    addSupportButton.textContent = 'Add Support';
    document.querySelector('.controls').appendChild(addSupportButton);
    
    // Track removal mode
    let removalMode = false;
    
    // Flag to prevent update loops
    let isCurrentlySaving = false;
    
    // Sample staff members (used only if no data exists)
    const sampleStaff = [
        { id: 'sample1', name: 'John Doe', photo: 'placeholder-photo.jpg' },
        { id: 'sample2', name: 'Jane Smith', photo: 'placeholder-photo.jpg' },
        { id: 'sample3', name: 'Mike Johnson', photo: 'placeholder-photo.jpg' },
        { id: 'sample4', name: 'Sarah Williams', photo: 'placeholder-photo.jpg' },
        { id: 'sample5', name: 'David Brown', photo: 'placeholder-photo.jpg' }
    ];
    
    // Initialize
    init();
    
    function init() {
        console.log('Initializing planning board...');
        
        // Set initial connection status
        updateConnectionStatus('connecting', 'Connecting...');
        
        // Setup connection monitoring
        setupConnectionMonitoring();
        
        // Clear existing staff cards to avoid duplicates
        availableStaffContainer.innerHTML = '';
        
        // Check if the board exists in Firebase
        planningBoardRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Found existing board data in Firebase');
                    // Board exists, load data from Firebase
                    const savedData = snapshot.val();
                    populateFromSavedData(savedData);
                } else {
                    console.log('No existing board data, using sample data');
                    // No board data in Firebase, use sample data
                    sampleStaff.forEach(staff => {
                        createStaffCard(staff.id, staff.name, staff.photo);
                    });
                    // Save sample data to Firebase
                    saveToFirebase();
                }
                
                // Listen for real-time updates
                setupRealtimeListeners();
                
                // Set up event listeners
                setupEventListeners();
                
                console.log('Initialization complete');
            })
            .catch(error => {
                console.error('Error initializing from Firebase:', error);
                updateConnectionStatus('error', 'Connection Error');
                
                // Fall back to sample data
                sampleStaff.forEach(staff => {
                    createStaffCard(staff.id, staff.name, staff.photo);
                });
                
                // Set up event listeners anyway
                setupEventListeners();
            });
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
    
    function updateConnectionStatus(status, message) {
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
    
    function setupRealtimeListeners() {
        // Listen for changes to the board data
        planningBoardRef.on('value', snapshot => {
            if (snapshot.exists()) {
                const firebaseData = snapshot.val();
                
                // Only update if we're not the ones who just made the change
                if (!isCurrentlySaving) {
                    console.log('Received update from Firebase, applying changes');
                    updateConnectionStatus('syncing', 'Syncing...');
                    populateFromSavedData(firebaseData);
                    setTimeout(() => {
                        updateConnectionStatus('online', 'Online');
                    }, 500);
                } else {
                    console.log('Ignoring Firebase update as we just saved this data');
                }
            } else {
                console.warn('No data in Firebase snapshot');
            }
        }, error => {
            console.error('Firebase data sync error:', error);
            updateConnectionStatus('error', 'Sync Error');
        });
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
                const staffId = 'support-' + Date.now(); // Use timestamp for unique IDs
                const photoSrc = createPlaceholderImage();
                createStaffCard(staffId, supportName.trim(), photoSrc);
                saveToFirebase();
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
        
        // Save board button
        saveButton.addEventListener('click', () => saveToFirebase());
        
        // Reset board
        resetButton.addEventListener('click', confirmReset);
        
        // Set up drag and drop
        setupDragAndDrop();
        
        // Floor toggle buttons
        floorToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                // Get the parent floor div
                const floor = this.closest('.floor');
                
                // Toggle the collapsed class
                floor.classList.toggle('collapsed');
                
                // Update the toggle button text
                this.textContent = floor.classList.contains('collapsed') ? '+' : '−';
                
                // Stop event propagation to prevent affecting other floors
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
            card.remove();
            saveToFirebase();
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
                finishAddingStaff(name, photoSrc);
            };
            
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            finishAddingStaff(name, photoSrc);
        }
    }
    
    // Create a placeholder image with MDT text
    function createPlaceholderImage() {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        
        // Get the context
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
        
        // Convert to data URL
        return canvas.toDataURL('image/png');
    }
    
    function finishAddingStaff(name, photoSrc) {
        const staffId = 'staff-' + Date.now(); // Use timestamp for unique IDs
        
        // If photoSrc is the default placeholder, replace with our custom one
        if (photoSrc === 'placeholder-photo.jpg') {
            photoSrc = createPlaceholderImage();
        }
        
        createStaffCard(staffId, name, photoSrc);
        
        // Reset form and close modal
        document.getElementById('staff-name').value = '';
        document.getElementById('staff-photo').value = '';
        modal.style.display = 'none';
        
        // Save to Firebase
        saveToFirebase();
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
            
            // Save board state
            saveToFirebase();
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
                // Remove from previous container
                staffCard.parentNode.removeChild(staffCard);
                
                // Add to this dropzone
                zone.appendChild(staffCard);
                
                // Animation effect
                staffCard.classList.add('dropped');
                setTimeout(() => {
                    staffCard.classList.remove('dropped');
                }, 300);
                
                // Equalize heights in the same row
                equalizeHeightsInRow(zone);
                
                // Save to Firebase
                saveToFirebase();
            }
        });
    }
    
    // Make staff pool a valid dropzone for returning operators
    function setupStaffPoolAsDropZone() {
        // Make both the container and section droppable
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
                    // Only proceed if the card is from a position
                    const fromPosition = staffCard.closest('.staff-dropzone');
                    if (fromPosition) {
                        // Remove from position
                        staffCard.parentNode.removeChild(staffCard);
                        
                        // Add back to staff pool container
                        availableStaffContainer.appendChild(staffCard);
                        
                        // Equalize heights in the original row
                        equalizeHeightsInRow(fromPosition);
                        
                        // Save to Firebase
                        saveToFirebase();
                    }
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
    
    function saveToFirebase() {
        // Set the saving flag to prevent update loops
        isCurrentlySaving = true;
        updateConnectionStatus('syncing', 'Saving...');
        
        // Create the data structure
        const planningData = {
            timestamp: Date.now(), // Add timestamp for versioning
            staff: [],
            positions: {}
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
        
        // Save all assigned positions
        allDropZones.forEach(zone => {
            const positionSlot = zone.closest('.position-slot');
            if (!positionSlot) return;
            
            const positionId = positionSlot.getAttribute('data-position');
            const staffCards = zone.querySelectorAll('.staff-card');
            
            if (staffCards.length > 0) {
                planningData.positions[positionId] = Array.from(staffCards).map(card => 
                    card.getAttribute('data-id')
                );
            } else {
                // Explicitly set empty positions to empty array 
                // This ensures they are cleared on other clients
                planningData.positions[positionId] = [];
            }
        });
        
        // Save to Firebase
        planningBoardRef.set(planningData)
            .then(() => {
                console.log('Board saved successfully to Firebase');
                updateConnectionStatus('online', 'Saved');
                
                // Reset saving flag after a short delay
                setTimeout(() => {
                    isCurrentlySaving = false;
                }, 500);
            })
            .catch(error => {
                console.error('Error saving to Firebase:', error);
                updateConnectionStatus('error', 'Save Error');
                isCurrentlySaving = false;
            });
    }
    
    function populateFromSavedData(data) {
        console.log('Populating from Firebase data:', data);
        
        if (!data || !data.staff) {
            console.error('Invalid data structure received from Firebase');
            return;
        }
        
        // First, cache all existing staff cards by their IDs for later
        const existingStaffCards = {};
        document.querySelectorAll('.staff-card').forEach(card => {
            const id = card.getAttribute('data-id');
            existingStaffCards[id] = card;
        });
        
        // Clear both staff pool and all position dropzones
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Initialize an array to track which staff is placed in positions
        const placedStaffIds = [];
        
        // First, handle position assignments
        if (data.positions) {
            for (const positionId in data.positions) {
                const staffIds = data.positions[positionId];
                const positionSlot = document.querySelector(`[data-position="${positionId}"]`);
                
                if (positionSlot) {
                    const dropzone = positionSlot.querySelector('.staff-dropzone');
                    
                    // Check if the position data is valid
                    if (Array.isArray(staffIds)) {
                        staffIds.forEach(staffId => {
                            // Find the staff data
                            const staffData = data.staff.find(s => s.id === staffId);
                            
                            if (staffData) {
                                // Create or reuse the staff card
                                let staffCard;
                                
                                if (existingStaffCards[staffId]) {
                                    staffCard = existingStaffCards[staffId];
                                    delete existingStaffCards[staffId]; // Remove from tracking
                                } else {
                                    // Create a new card if it doesn't exist
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
                                    
                                    // Setup drag events for this new card
                                    setupDragEventsForElement(staffCard);
                                }
                                
                                // Add to position
                                dropzone.appendChild(staffCard);
                                
                                // Track that this staff is placed
                                placedStaffIds.push(staffId);
                            }
                        });
                    }
                    
                    // Update the heights for this row
                    equalizeHeightsInRow(dropzone);
                }
            }
        }
        
        // Now add any staff that isn't placed in a position to the available pool
        data.staff.forEach(staff => {
            // Skip staff that's already placed in a position
            if (!placedStaffIds.includes(staff.id)) {
                // Check if we have an existing card to reuse
                if (existingStaffCards[staff.id]) {
                    availableStaffContainer.appendChild(existingStaffCards[staff.id]);
                    delete existingStaffCards[staff.id]; // Remove from tracking
                } else {
                    // Create a new card
                    createStaffCard(staff.id, staff.name, staff.photo);
                }
            }
        });
        
        // Re-attach drag events to all cards in case they were lost
        setupDragAndDrop();
        
        // Print any staff that wasn't reused (should normally be none)
        const unusedStaffIds = Object.keys(existingStaffCards);
        if (unusedStaffIds.length > 0) {
            console.log('Staff cards that were not reused:', unusedStaffIds);
        }
    }
    
    function confirmReset() {
        if (confirm('Are you sure you want to reset the planning board? All assignments will be cleared.')) {
            resetBoard();
        }
    }
    
    function resetBoard() {
        // Move all staff cards back to the pool
        document.querySelectorAll('.staff-dropzone .staff-card').forEach(card => {
            availableStaffContainer.appendChild(card);
        });
        
        // Save the reset state
        saveToFirebase();
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