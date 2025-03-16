// Firebase configuration
// Add this at the top of your script.js file
document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration
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
    
    // Staff ID counter
    let staffIdCounter = 1;
    
    // Sample staff members (can be removed in production)
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
        // Clear existing staff cards to avoid duplicates
        availableStaffContainer.innerHTML = '';
        
        // Check if the board exists in Firebase
        planningBoardRef.once('value', snapshot => {
            if (snapshot.exists()) {
                // Board exists, load data from Firebase
                const savedData = snapshot.val();
                populateFromSavedData(savedData);
            } else {
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
        });
    }

    // Add this to your script.js file after the init() function

    function setupConnectionStatus() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        // Check connection to Firebase
        const connectedRef = firebase.database().ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                statusIndicator.classList.remove('offline');
                statusIndicator.classList.add('online');
                statusText.textContent = 'Online';
            } else {
                statusIndicator.classList.remove('online');
                statusIndicator.classList.add('offline');
                statusText.textContent = 'Offline';
            }
        });
        
        // Show syncing status during updates
        planningBoardRef.on('value', () => {
            if (!isCurrentlySaving) {
                statusIndicator.classList.remove('online', 'offline');
                statusIndicator.classList.add('syncing');
                statusText.textContent = 'Syncing...';
                
                setTimeout(() => {
                    statusIndicator.classList.remove('syncing');
                    statusIndicator.classList.add('online');
                    statusText.textContent = 'Online';
                }, 1000);
            }
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
        
        // Save board - now just syncs to Firebase
        saveButton.addEventListener('click', saveToFirebase);
        
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
    
    function setupRealtimeListeners() {
        // Listen for changes to the board data
        planningBoardRef.on('value', snapshot => {
            if (snapshot.exists()) {
                const firebaseData = snapshot.val();
                
                // Only update if we're not the ones who just made the change
                if (!isCurrentlySaving) {
                    console.log('Received update from Firebase');
                    populateFromSavedData(firebaseData);
                }
            }
        });
    }
    
    // Flag to prevent update loops
    let isCurrentlySaving = false;
    
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
        isCurrentlySaving = true;
        const planningData = {
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
            }
        });
        
        // Save to Firebase
        planningBoardRef.set(planningData)
            .then(() => {
                console.log('Board saved successfully to Firebase');
                setTimeout(() => {
                    isCurrentlySaving = false;
                }, 100);
            })
            .catch(error => {
                console.error('Error saving to Firebase:', error);
                isCurrentlySaving = false;
            });
    }
    
    function populateFromSavedData(data) {
        // Clear existing staff and assignments
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Add all staff to the pool first
        if (data.staff && Array.isArray(data.staff)) {
            data.staff.forEach(staff => {
                createStaffCard(staff.id, staff.name, staff.photo);
            });
        }
        
        // Assign staff to positions
        if (data.positions) {
            for (const positionId in data.positions) {
                const staffIds = data.positions[positionId];
                const positionSlot = document.querySelector(`[data-position="${positionId}"]`);
                
                if (positionSlot) {
                    const dropzone = positionSlot.querySelector('.staff-dropzone');
                    
                    // Handle both old format (single ID) and new format (array of IDs)
                    const idsArray = Array.isArray(staffIds) ? staffIds : [staffIds];
                    
                    idsArray.forEach(staffId => {
                        const staffCard = document.querySelector(`[data-id="${staffId}"]`);
                        if (staffCard) {
                            staffCard.parentNode.removeChild(staffCard);
                            dropzone.appendChild(staffCard);
                        }
                    });
                    
                    // Equalize heights
                    equalizeHeightsInRow(dropzone);
                }
            }
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