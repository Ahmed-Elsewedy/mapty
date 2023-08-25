'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]
      } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// ------- Architcture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const removeAll = document.querySelector('#removeAll');
const sortAll = document.querySelector('#sortAll');
const errorBox = document.querySelector('.error-box');
const successBox = document.querySelector('.success-box');

class App {
  #map;
  #markers = []
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #sort = false;

  constructor() {
    this._getPosition();
    this._getLocalStorage();

    // Attach event handlers...
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    removeAll.addEventListener('click', this._removeAll.bind(this));
    sortAll.addEventListener('click', this._sortAll.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    // Create a button control
    var buttonControl = L.Control.extend({
      options: {
        position: 'topright' // Change this to your preferred position
      },

      onAdd: function (map) {
        var container = L.DomUtil.create('button', 'all-workout');
        container.textContent = 'All workouts';
        return container;
      }
    });


    this.#map.addControl(new buttonControl());
    const self = this;
    document.querySelector('.all-workout').addEventListener('click', function (e) {
      e.stopPropagation();
      self._showAllWorkouts();
    })

    this._removeAllChecker();
  }

  _showForm(mapE) {
    if (mapE)
      this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value =
      '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {

    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    if (!errorBox.classList.contains('hidden'))
      errorBox.classList.add('hidden')

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return errorBox.classList.remove('hidden');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return errorBox.classList.remove('hidden');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }


    this.#workouts.push(workout);

    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);

    this._hideForm();

    this._setLocalStorage();

    this._removeAllChecker();

    // success message
    successBox.classList.remove('hidden');
    setTimeout(function () {
      successBox.classList.add('hidden');
    }, 2000)
  }

  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}" id="${workout.id}">
        <h2 class="workout__title">
          ${workout.description}
          <div class="editdelete">
            <button class="edit" id="${workout.id + '-edit'}">
              <img src="images/edit-button.png" width="20px">
            </button>
            <button class="delete" id="${workout.id + '-delete'}">
              <img src="images/delete.png" width="20px">
            </button>
          </div>
        </h2>
        
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
    // this._editField(workout);
    this._deleteHandel(workout);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    let data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
  // edit
  // _editField(workout) {
  //   let self = this;

  //   document.getElementById(`${workout.id}`).addEventListener('click', function () {
  //     // show form ------------------------------ 
  //     form.classList.remove('hidden');
  //     if (workout.type !== inputType.value) self._toggleElevationField();
  //     // show last data -------------------------
  //     inputType.value = workout.type;
  //     inputDistance.value = workout.distance;
  //     inputDuration.value = workout.duration;
  //     if (workout.type === 'running')
  //       inputCadence.value = workout.cadence;
  //     if (workout.type === 'cycling')
  //       inputElevation.value = workout.elevationGain;
  //     // check validation ----------------------------

  //     // remove last
  //     // add new data
  //   })
  // }

  _deleteHandel(workout) {
    const self = this;
    document.getElementById(`${workout.id + '-delete'}`).addEventListener('click', function (event) {
      event.stopPropagation();
      self.#workouts = self.#workouts.filter(el => el.id !== workout.id);
      document.getElementById(`${workout.id}`).remove();
      self._setLocalStorage();
      self._removeMarkerByCoordinates(...workout.coords);

    })

    this._removeAllChecker();
  }

  _removeMarkerByCoordinates(lat, lng) {
    for (let i = 0; i < this.#markers.length; i++) {
      let marker = this.#markers[i];
      let markerLatLng = marker.getLatLng();
      if (markerLatLng.lat === lat && markerLatLng.lng === lng) {
        this.#map.removeLayer(marker);
        this.#markers.splice(i, 1);
        break;
      }
    }
    this._removeAllChecker();
  }

  _removeAll() {
    this.#markers.forEach(el => {
      this.#map.removeLayer(el)
    });
    this.#workouts.forEach(el => {
      document.getElementById(`${el.id}`).remove();
    })
    this.#markers = [];
    this.#workouts = [];
    console.log('remove');
    removeAll.classList.add('hidden');
    localStorage.removeItem('workouts');
    this._removeAllChecker();
  }

  _sortAll() {

    const removeExist = () => {
      this.#workouts.forEach(el => {
        document.getElementById(`${el.id}`).remove();
      })
    };
    const setNew = function (arr, self) {
      arr.forEach(el => {
        self._renderWorkout(el);
      });
    }

    if (this.#sort === false) {
      const arr = [...this.#workouts];

      arr.sort((a, b) => a.type !== b.type ? a.type.localeCompare(b.type) : a.distance - b.distance)

      removeExist();

      setNew(arr, this);

      sortAll.textContent = 'Un Sort';

    } else {

      removeExist();
      setNew(this.#workouts, this);

      sortAll.textContent = 'Sort All';
    }
    this.#sort = !this.#sort;
  };

  _removeAllChecker() {
    if (this.#workouts.length > 0) {
      removeAll.classList = '';
      sortAll.classList = '';
    } else {
      removeAll.classList = 'hidden';
      sortAll.classList = 'hidden';
    }
  }

  _sortByDistance() { }

  _showAllWorkouts() {
    var markersGroup = L.featureGroup(this.#markers);
    this.#map.fitBounds(markersGroup.getBounds());
  }

}

const app = new App();
