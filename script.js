document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const staffPool = document.getElementById('available-staff');
    const addStaffButton = document.getElementById('add-staff');
    const removeStaffButton = document.getElementById('remove-staff');
    const saveButton = document.getElementById('save-board');
    const resetButton = document.getElementById('reset-board');
    const modal = document.getElementById('add-staff-modal');
    const closeButton = document.querySelector('.close-button');
    const newStaffForm = document.getElementById('new-staff-form');
    const allDropZones = document.querySelectorAll('.staff-dropzone');
    const floorToggles = document.querySelectorAll('.floor-toggle');
    
    // Track removal mode
    let removalMode = false;
    
    // Local storage key
    const STORAGE_KEY = 'warehousePlanningData';
    
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
        // Load data from local storage or use sample data
        const savedData = loadFromLocalStorage();
        
        if (savedData) {
            // Populate staff pool and positions from saved data
            populateFromSavedData(savedData);
        } else {
            // Use sample data
            sampleStaff.forEach(staff => {
                createStaffCard(staff.id, staff.name, staff.photo);
            });
        }
        
        // Set up event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Add staff button
        addStaffButton.addEventListener('click', () => {
            modal.style.display = 'block';
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
        
        // Save board
        saveButton.addEventListener('click', saveToLocalStorage);
        
        // Reset board
        resetButton.addEventListener('click', confirmReset);
        
        // Set up drag and drop
        setupDragAndDrop();
        
        // Floor toggle buttons
        floorToggles.forEach(toggle => {
            toggle.addEventListener('click', toggleFloor);
        });
    }
    
    function toggleFloor(e) {
        const floor = e.target.closest('.floor');
        floor.classList.toggle('collapsed');
        
        if (floor.classList.contains('collapsed')) {
            e.target.textContent = '+';
        } else {
            e.target.textContent = '−';
        }
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
            const confirmRemoval = confirm(`Are you sure you want to remove ${card.querySelector('.staff-name').textContent}?`);
            
            if (confirmRemoval) {
                card.remove();
                saveToLocalStorage();
            }
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
    
    function finishAddingStaff(name, photoSrc) {
        const staffId = 'staff-' + staffIdCounter++;
        createStaffCard(staffId, name, photoSrc);
        
        // Reset form and close modal
        document.getElementById('staff-name').value = '';
        document.getElementById('staff-photo').value = '';
        modal.style.display = 'none';
        
        // Save to local storage
        saveToLocalStorage();
    }
    
    function createStaffCard(id, name, photoSrc) {
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
        staffPool.appendChild(staffCard);
        
        // Set up drag events for the new card
        setupDragEventsForElement(staffCard);
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
            saveToLocalStorage();
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
            }
        });
    }
    
    // Make staff pool a valid dropzone for returning operators
    function setupStaffPoolAsDropZone() {
        staffPool.addEventListener('dragover', (e) => {
            e.preventDefault();
            staffPool.classList.add('highlight');
        });
        
        staffPool.addEventListener('dragleave', () => {
            staffPool.classList.remove('highlight');
        });
        
        staffPool.addEventListener('drop', (e) => {
            e.preventDefault();
            staffPool.classList.remove('highlight');
            
            const staffId = e.dataTransfer.getData('text/plain');
            const staffCard = document.querySelector(`[data-id="${staffId}"]`);
            
            if (staffCard) {
                // Only allow dropping back to pool if from a position
                const fromPosition = staffCard.closest('.staff-dropzone');
                if (fromPosition) {
                    // Remove from position
                    staffCard.parentNode.removeChild(staffCard);
                    
                    // Add back to staff pool
                    staffPool.appendChild(staffCard);
                    
                    // Equalize heights in the original row
                    equalizeHeightsInRow(fromPosition);
                    
                    // Save board state
                    saveToLocalStorage();
                }
            }
        });
    }
    
    function equalizeHeightsInRow(zone) {
        // Find the row this zone belongs to
        const positionSlot = zone.closest('.position-slot');
        const row = positionSlot.parentElement;
        
        // Get all dropzones in this row
        const dropzonesInRow = Array.from(row.querySelectorAll('.staff-dropzone'));
        
        // Reset heights first
        dropzonesInRow.forEach(dz => {
            dz.style.height = 'auto';
        });
        
        // Wait for the DOM to update
        setTimeout(() => {
            // Find the tallest dropzone
            const maxHeight = Math.max(...dropzonesInRow.map(dz => dz.offsetHeight));
            
            // Set all dropzones to the tallest height
            dropzonesInRow.forEach(dz => {
                dz.style.height = maxHeight + 'px';
            });
        }, 10);
    }
    
    function saveToLocalStorage() {
        const planningData = {
            staff: [],
            positions: {}
        };
        
        // Save all staff in the pool
        staffPool.querySelectorAll('.staff-card').forEach(card => {
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
            const positionId = zone.closest('.position-slot').getAttribute('data-position');
            const staffCards = zone.querySelectorAll('.staff-card');
            
            if (staffCards.length > 0) {
                planningData.positions[positionId] = Array.from(staffCards).map(card => 
                    card.getAttribute('data-id')
                );
            }
        });
        
        // Save to local storage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planningData));
        
        // Notify user
        alert('Planning board saved successfully!');
    }
    
    function loadFromLocalStorage() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        return savedData ? JSON.parse(savedData) : null;
    }
    
    function populateFromSavedData(data) {
        // Clear existing staff
        staffPool.innerHTML = '';
        
        // Add all staff to the pool
        data.staff.forEach(staff => {
            createStaffCard(staff.id, staff.name, staff.photo);
        });
        
        // Assign staff to positions
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
        
        // Update staff ID counter to be higher than any existing ID
        data.staff.forEach(staff => {
            const idMatch = staff.id.match(/staff-(\d+)/);
            if (idMatch && parseInt(idMatch[1]) >= staffIdCounter) {
                staffIdCounter = parseInt(idMatch[1]) + 1;
            }
        });
    }
    
    function confirmReset() {
        if (confirm('Are you sure you want to reset the planning board? All assignments will be cleared.')) {
            resetBoard();
        }
    }
    
    function resetBoard() {
        // Move all staff cards back to the pool
        document.querySelectorAll('.staff-dropzone .staff-card').forEach(card => {
            staffPool.appendChild(card);
        });
        
        // Save the reset state
        saveToLocalStorage();
    }
    
    // Register a new staff card for removal mode if it's active
    function registerForRemoval(card) {
        if (removalMode) {
            card.classList.add('removable');
            card.addEventListener('click', removeStaffCard);
        }
    }
    
    function createStaffCard(id, name, photoSrc) {
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
        staffPool.appendChild(staffCard);
        
        // Set up drag events for the new card
        setupDragEventsForElement(staffCard);
        
        // Register for removal if in removal mode
        registerForRemoval(staffCard);
    }
});