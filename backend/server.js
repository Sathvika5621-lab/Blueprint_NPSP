    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors');
    const path = require('path');
    const { Pool } = require('pg');
    const nodemailer = require('nodemailer');
    const crypto = require('crypto'); // For generating the OTP

    require('dotenv').config();

    const app = express();
    const port = process.env.PORT ;

    // Enable CORS for all routes
    app.use(cors({
      origin: 'https://multicenterpreclinicalstudy-4e55e83b8d96.herokuapp.com',
      methods: ['GET', 'POST', 'PUT'], //to Ensure PUT is included here
  }));

    // Middleware to parse JSON
    app.use(bodyParser.json());

    // PostgreSQL Pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    // Create a Nodemailer transporter using environment variables
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_ADDRESS, 
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Temporary storage for OTPs
    const otpStore = {};

    // CORS configuration: Allow only the Heroku frontend URL in production
    const allowedOrigins = ['https://multicenterpreclinicalstudy-4e55e83b8d96.herokuapp.com'];
    app.use(cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }));

    // Check database connection on startup
    pool.connect((err, client, release) => {
      if (err) {
        console.error('Error connecting to the database', err.stack);
      } else {
        console.log('Connected to the database successfully!');
        release();
      }
    });

    // API route to register a user (POST method)
    app.post('/api/register', async (req, res) => {


      console.log('Received data:', req.body);
      const {
        hqp_id, firstName, lastName, email, password, studyInvolvedIn, occupation,
        ali_site_name, npsp_site_name, leadHQPali, leadHQPnpsp, aliTasksCompleted, npspTasksCompleted,
        aliSOPsTrainingsCompleted, npspSOPsTrainingsCompleted, notSelectedAliSOPs, notSelectedNpspSOPs,
        notSelectedAliTasks, notSelectedNpspTasks
      } = req.body;

      try {
        // Insert user data including new fields
        await pool.query(
          `INSERT INTO users (
              hqp_id, first_name, last_name, email_address, password, study_involved_in,
              occupation, ali_site_name, npsp_site_name, lead_hqp_ali, lead_hqp_npsp, ali_tasks_completed,
              npsp_tasks_completed, ali_sops_trainings_completed, npsp_sops_trainings_completed,
              not_selected_ali_sops, not_selected_npsp_sops, not_selected_ali_tasks, not_selected_npsp_tasks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            hqp_id, firstName, lastName, email, password, studyInvolvedIn, occupation,
            ali_site_name, npsp_site_name, leadHQPali, leadHQPnpsp, aliTasksCompleted,
            npspTasksCompleted, aliSOPsTrainingsCompleted, npspSOPsTrainingsCompleted,
            notSelectedAliSOPs, notSelectedNpspSOPs, notSelectedAliTasks, notSelectedNpspTasks
          ]
        );
        res.status(201).json({ message: 'User registered successfully' });

      } catch (error) {

        if(error.code === '23505'){
          console.error('Error inserting user: Email already exists');
          res.status(400).json({error:'Email already exists. Please use a different email.'});
        }
        else{
          console.error('Unexpected error inserting user:', error.stack || error.message);
          res.status(500).json({ error: 'Error registering user', details: error.message || 'No error details available' });
      }
    }
    });


    // Backend route to get the next serial number for HQP
    app.get('/api/get-next-serial-number', async (req, res) => {
      try {
        // Assuming your users table holds the HQP IDs and they are in the format 'JD001'
        const result = await pool.query("SELECT MAX(SUBSTRING(hqp_id, 3, 3))::int as max_serial FROM users");

        let nextSerialNumber = 1;
        if (result.rows[0].max_serial !== null) {
          nextSerialNumber = result.rows[0].max_serial + 1;
        }

        res.json({ serialNumber: nextSerialNumber });
      } catch (error) {
        console.error('Error fetching next serial number:', error);
        res.status(500).json({ error: 'Failed to fetch next serial number' });
      }
    });

    // authentication using plain-text password during login
    app.post('/api/login', async (req, res) => {
      console.log('Received login request:', req.body);
      const { email, password } = req.body;
      
      try {
        const result = await pool.query(
          'SELECT * FROM users WHERE LOWER(email_address) = LOWER($1)', 
          [email]
        );
        const user = result.rows[0];
        if (!user) {
          return res.status(400).json({ message: 'User not found' });
        }
        console.log('User from database:', user);
        
        // Compare the provided password with the stored plain-text password
        if (password !== user.password) {
          return res.status(400).json({ message: 'Invalid password' });
        }
        
        // If authentication is successful, return a success message along with user data
        res.json({ message: 'Login successful', user });
      } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    // for forgot password
    app.post('/api/forgot-password', async (req, res) => {
      const { email, newPassword } = req.body;

      try {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email_address) = $1', [email]);
        const user = result.rows[0];

        if (!user) {
          return res.status(400).json({ message: 'User not found' });
        }

        // Update the plain-text password in the database
        await pool.query('UPDATE users SET password = $1 WHERE LOWER(email_address) = $2', [newPassword, email]);

        res.json({ message: 'Password updated successfully' });
      } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    app.get('/api/get-hqp-details', async (req, res) => {
      try {
          const result = await pool.query('SELECT * FROM users');
          res.json(result.rows);
      } catch (error) {
          console.error('Error fetching HQP details:', error);
          res.status(500).json({ error: 'Failed to fetch HQP details' });
      }
    });
    // Endpoint to get user details by email_address
    app.get('/api/user', async (req, res) => {
      const email = req.query.email;
      try {
        const result = await pool.query('SELECT * FROM users WHERE email_address = $1', [email]);
        if (result.rows.length === 0) {
          console.log("User not found for email:", email); 
          return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
      } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
      }
    });

    // Endpoint to update user details

    app.put('/api/user/update', async (req, res) => {
      const { email, updatedFields } = req.body; // Email for identification, updatedFields for fields to update

      try {
        // Construct the SQL query dynamically based on provided fields
        const fieldsToUpdate = Object.keys(updatedFields)
          .map((field, index) => `${field} = $${index + 1}`)
          .join(', ');
          
        const values = [...Object.values(updatedFields), email];

        // Construct the SQL query for updating
        const query = `
          UPDATE users
          SET ${fieldsToUpdate}
          WHERE email_address = $${values.length}
        `;

        await pool.query(query, values);
        res.json({ message: 'Profile updated successfully.' });
      } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile.' });
      }
    });

    // API route to handle mouse details
    app.post('/api/mouse-details', async (req, res) => {
      const {
        maleMiceCount, femaleMiceCount, site, deliveryDate, studyDate, slurrydose, endpoint,
        studytype, strain, animalprovider, cagetype, treatedwater, typeoffood,
        enrichmentmaterials, humidity, temperature, noiselevel, racksarrangement,
        lightcyclestarttime, lightcycle, housingPerCage, npspCoordinatorCommunication,
        deviations, comments, hqpDataEntryEmail, hqpHousingCheckEmail, beddingtype
      } = req.body;

      try {
        // Validate and parse the dates
        const studyDateFormatted = new Date(studyDate).toLocaleDateString('en-CA');
        const deliveryDateFormatted = new Date(deliveryDate).toLocaleDateString('en-CA');

      if (!studyDateFormatted || !deliveryDateFormatted) {
          return res.status(400).json({ error: 'Invalid date format for study date or delivery date' });
        }

        // Validate time format (light cycle start time)
        const lightCycleTimeFormatted = lightcyclestarttime ? lightcyclestarttime : null;
        if (!lightCycleTimeFormatted) {
          return res.status(400).json({ error: 'Invalid time format for light cycle start time' });
        }

        // Map center codes
        const centerCodes = {
          Ottawa: '1', McMaster: '2', Western: '3', Manitoba: '4', Alberta: '5', Calgary: '6'
        };

        const centerCode = centerCodes[site];
            // Step 1: Retrieve or initialize the study number for the center
            const studyResult = await pool.query(
              `SELECT MAX(study_number) AS max_study_number 
               FROM mouse_npsp 
               WHERE site_name = $1`,
              [site]
          );
            // If there's no study yet for the center, the study number starts from 0
            let currentStudyNumber = studyResult.rows[0].max_study_number ? studyResult.rows[0].max_study_number : 0;

            // Step 2: Check if the study date exists for this center. If it exists, use the current study number; otherwise, increment it.
            const dateResult = await pool.query(
              `SELECT study_number 
               FROM mouse_npsp 
               WHERE site_name = $1 AND planned_study_date = $2`,
              [site, studyDateFormatted]
            );

        if (dateResult.rows.length === 0) {
          currentStudyNumber++; // Increment study number for a new study date
        }
        const mouseResult = await pool.query(
          `SELECT MAX(CAST(SUBSTRING(mouse_id, 15, 3) AS INTEGER)) as max_mouse_number
           FROM mouse_npsp
           WHERE site_name = $1`,
          [site]
        );


        let mouseNumber = mouseResult.rows[0].max_mouse_number
        ? mouseResult.rows[0].max_mouse_number + 1
        : 1;

      const mouseDetails = [];
      const sexes = [
          ...Array(maleMiceCount).fill('Male'),
          ...Array(femaleMiceCount).fill('Female')
      ];

        
        // Step 4: Generate mouse IDs and prepare the data
        for (let sex of sexes) {
          const mouseID = `NPSP-C${centerCode}-S${String(currentStudyNumber).padStart(2, '0')}-M${String(mouseNumber).padStart(3, '0')}`;
          mouseDetails.push({
            mouse_id: mouseID,
            site_name: site,
            sex_of_mouse: sex,
            animal_delivery_date: deliveryDateFormatted,
            planned_study_date: studyDateFormatted,
            fecal_slurry_dose: slurrydose,
            study_endpoint: endpoint,
            study_type: studytype,
            strain_of_mice: strain,
            animal_source: animalprovider,
            cage_type: cagetype,
            treated_water: treatedwater,
            food_type: typeoffood,
            enrichment_materials: enrichmentmaterials.join(', '), // assuming it's an array
            bedding_type: beddingtype.join(', '),
            room_humidity: humidity,
            room_temperature: temperature,
            noise_level: noiselevel,
            rack_arrangement: racksarrangement,
            light_cycle_start_time: lightCycleTimeFormatted,
            light_cycle_type: lightcycle,
            housed_per_cage: housingPerCage,
            npsp_coordinator_communication: npspCoordinatorCommunication,
            deviations_animalhousing: deviations,
            comments_animalhousing: comments,
            no_of_male_mice: maleMiceCount,
            no_of_female_mice: femaleMiceCount,
            study_number: currentStudyNumber,
            hqp_data_entry_email: hqpDataEntryEmail,    // Add HQP emails here
            hqp_housing_check_email: hqpHousingCheckEmail // Add HQP emails here
          });
          mouseNumber++;
        }

        // Step 5: Store the mouse details in the database
    const query = `
        INSERT INTO mouse_npsp (
          mouse_id, site_name, sex_of_mouse, animal_delivery_date, planned_study_date,
          fecal_slurry_dose, study_endpoint, study_type, strain_of_mice, animal_source,
          cage_type, treated_water, food_type, enrichment_materials, bedding_type, room_humidity, 
          room_temperature, noise_level, rack_arrangement, light_cycle_start_time, 
          light_cycle_type, housed_per_cage, npsp_coordinator_communication, 
          deviations_animalhousing, comments_animalhousing, no_of_male_mice, no_of_female_mice, 
          study_number, hqp_data_entry_email, hqp_housing_check_email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      `;

    for (let mouse of mouseDetails) {
      await pool.query(query, [
        mouse.mouse_id, mouse.site_name, mouse.sex_of_mouse, deliveryDateFormatted, 
        studyDateFormatted, mouse.fecal_slurry_dose, mouse.study_endpoint, mouse.study_type,
        mouse.strain_of_mice, mouse.animal_source, mouse.cage_type, mouse.treated_water, mouse.food_type,
        mouse.enrichment_materials, mouse.bedding_type, mouse.room_humidity, mouse.room_temperature, 
        mouse.noise_level, mouse.rack_arrangement, mouse.light_cycle_start_time, mouse.light_cycle_type, 
        mouse.housed_per_cage, mouse.npsp_coordinator_communication, mouse.deviations_animalhousing, 
        mouse.comments_animalhousing, mouse.no_of_male_mice, mouse.no_of_female_mice, mouse.study_number, 
        mouse.hqp_data_entry_email, mouse.hqp_housing_check_email
      ]);
    }

        res.status(200).json({ message: 'Mouse details added successfully', mouseDetails });
      } catch (error) {
        console.error('Error inserting mouse details:', error);
        res.status(500).json({ error: 'Failed to add mouse details', details: error.message });
      }
    });

    // Fetch mouse details from the database (new API endpoint)
    app.get('/api/mouse-details', async (req, res) => {
      try {
        // Query to fetch all mouse details
        const result = await pool.query('SELECT * FROM mouse_npsp ORDER BY mouse_id ASC');
            // Format the dates before sending the response
            const formattedData = result.rows.map(mouse => ({
              ...mouse,
              animal_delivery_date: mouse.animal_delivery_date.toISOString().split('T')[0],
              planned_study_date: mouse.planned_study_date.toISOString().split('T')[0],
            }));
        
        res.json(formattedData);
      } catch (error) {
        console.error('Error fetching mouse details:', error);
        res.status(500).json({ error: 'Failed to fetch mouse details' });
      }
    });


    app.put('/api/mouse-details', async (req, res) => {
      const {
          mouse_id,
          actual_study_date,
          date_of_birth,
          cage_id,
          is_study_date_different,
          exclusion_criteria,
          split_into_new_cage,
          date_split_into_cage,
          number_of_mice_in_cage,
          communicated_with_npsp_coordinator,
          itt_comments,
          hqp_itt_data_entry_email,
          hqp_itt_check_email,
          sex_of_mouse, // Add this field
      } = req.body;
  
      try {
          await pool.query(`
              UPDATE mouse_npsp 
              SET actual_study_date = $1, date_of_birth = $2, cage_id = $3,is_study_date_different= $4, exclusion_criteria = $5, 
                  split_into_new_cage = $6, date_split_into_cage = $7, 
                  number_of_mice_in_cage = $8, communicated_with_npsp_coordinator = $9, itt_comments = $10,
                  hqp_itt_data_entry_email = $11, hqp_itt_check_email = $12, sex_of_mouse = $13
              WHERE mouse_id = $14
          `, [
              actual_study_date,
              date_of_birth || null,
              cage_id,
              is_study_date_different,
              exclusion_criteria,
              split_into_new_cage,
              date_split_into_cage,
              number_of_mice_in_cage,
              communicated_with_npsp_coordinator,
              itt_comments,
              hqp_itt_data_entry_email,
              hqp_itt_check_email,
              sex_of_mouse, // Pass the new field value
              mouse_id,
          ]);
  
          res.status(200).json({ message: 'Mouse details updated successfully' });
      } catch (error) {
          console.error('Error updating mouse details:', error);
          res.status(500).json({ error: 'Failed to update mouse details' });
      }
  });

    // Backend route to update form progress
    app.put('/api/form-progress', async (req, res) => {
      const { mouse_id, form_name } = req.body;
    
      try {
        // Update the specific form as completed
        const result = await pool.query(
          `UPDATE mouse_npsp 
           SET form_completion = jsonb_set(
             COALESCE(form_completion, '{}'), 
             $2::text[], 
             '"completed"'
           ) 
           WHERE mouse_id = $1`,
          [mouse_id, `{${form_name}}`]
        );
    
        if (result.rowCount === 0) {
          return res.status(404).json({ message: 'Mouse ID not found' });
        }
    
        // Fetch the current form completion status
        const { rows } = await pool.query(
          `SELECT form_completion 
           FROM mouse_npsp 
           WHERE mouse_id = $1`,
          [mouse_id]
        );
    
        const formCompletion = rows[0]?.form_completion || {};
    
        // If both forms are completed, mark SyringePrep as completed
        if (
          formCompletion["SyringePrep T minus 1"] === "completed" &&
          formCompletion["SyringePrep T 3"] === "completed" &&
          formCompletion["SyringePrep"] !== "completed"
        ) {
          await pool.query(
            `UPDATE mouse_npsp 
             SET form_completion = jsonb_set(
               form_completion, 
               '{SyringePrep}', 
               '"completed"'
             ) 
             WHERE mouse_id = $1`,
            [mouse_id]
          );
        }
    
        res.status(200).json({ message: 'Form progress updated successfully' });
      } catch (error) {
        console.error('Error updating form progress:', error);
        res.status(500).json({ error: 'Failed to update form progress' });
      }
    });
    


    // Endpoint to fetch form completion data
    app.get('/api/form-completion/:mouseId', async (req, res) => {
      const { mouseId } = req.params;
      try {
        
          const result = await pool.query(
            `SELECT 
              form_completion,
              actual_study_date,
              date_of_birth,
              cage_id,
              is_study_date_different,
              exclusion_criteria,
              split_into_new_cage,
              date_split_into_cage,
              number_of_mice_in_cage,
              communicated_with_npsp_coordinator,
              itt_comments,
              hqp_itt_data_entry_email,
              hqp_itt_check_email,
              animal_delivery_date
            FROM mouse_npsp 
            WHERE mouse_id = $1`,
            [mouseId]
        
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Mouse not found' });
        }

        // If form_completion is null, initialize it as an empty object
        let formCompletion = result.rows[0].form_completion || {};
        
        const formData = {
          actualStudyDate: result.rows[0].actual_study_date,
          dateOfBirth: result.rows[0].date_of_birth,
          cageId: result.rows[0].cage_id,
          isStudyDateDifferent: result.rows[0].is_study_date_different,
          exclusionCriteria: result.rows[0].exclusion_criteria,
          splitIntoNewCage: result.rows[0].split_into_new_cage,
          dateSplitIntoCage: result.rows[0].date_split_into_cage,
          numberOfMiceInCage: result.rows[0].number_of_mice_in_cage,
          communicatedWithNpspCoordinator: result.rows[0].communicated_with_npsp_coordinator,
          ittComments: result.rows[0].itt_comments,
          hqpIttDataEntryEmail: result.rows[0].hqp_itt_data_entry_email,
          hqpIttCheckEmail: result.rows[0].hqp_itt_check_email,
          animalDeliveryDate: result.rows[0].animal_delivery_date,
        };

        res.json({ formCompletion, formData });
      } catch (error) {
        console.error('Error fetching form completion:', error);
        res.status(500).json({ error: 'Failed to fetch form completion status' });
      }
    });

    
  
    app.get('/api/bodyweight-temp/:mouseId', async (req, res) => {
      const { mouseId } = req.params;
  
      try {
          const result = await pool.query(
            `SELECT 
            body_weight_t0,
            temperature_t0,
            body_weight_t4,
            temperature_t4,
            body_weight_t8,
            temperature_t8,
            wellness_scores,
            hqp_bodyweight_temp_entry_email,
            hqp_bodyweight_temp_check_email,
            temperature_device_used,
            lubricant_used,
            temperature_complications,
            thermometer_cleaned,
            humane_endpoint,
            humane_endpoint_criteria,
            comments_bodyweight_temp,
            deviations_bodyweight_temp
         FROM mouse_npsp 
         WHERE mouse_id = $1`,
              [mouseId]
          );
  
          if (result.rows.length === 0) {
              return res.status(404).json({ error: 'Mouse not found' });
          }
  
          const row = result.rows[0];
  
          const formData = {
              timepoints: row.body_weight_and_temp_data || [
                  { timepoint: 'T = 0', bodyWeight: row.body_weight_t0, temperature: row.temperature_t0 },
                  { timepoint: 'T = 4', bodyWeight: row.body_weight_t4, temperature: row.temperature_t4 },
                  { timepoint: 'T = 8', bodyWeight: row.body_weight_t8, temperature: row.temperature_t8 }
              ],
              wellnessScores: row.wellness_scores || {
                  T0: [],
                  T4: [],
                  T6: [],
                  T8: []
              },
              hqpBodyweightTempDataEntryEmail: row.hqp_bodyweight_temp_entry_email || '',
              hqpBodyweightTempCheckEmail: row.hqp_bodyweight_temp_check_email || '',
              temperatureDevice: row.temperature_device_used || '',
              lubricant: row.lubricant_used || '',
              complication: row.temperature_complications || '',
              thermometerCleaned: row.thermometer_cleaned || '',
              humaneEndpoint: row.humane_endpoint || '',
              humaneEndpointCriteria: row.humane_endpoint_criteria || '',
              comments: row.comments_bodyweight_temp || '',
              deviations: row.deviations_bodyweight_temp || ''
          };
  
          res.json({ formData });
      } catch (error) {
          console.error('Error fetching Body Weight and Temperature form data:', error);
          res.status(500).json({ error: 'Failed to fetch Body Weight and Temperature form data' });
      }
  });
    
  app.put('/api/bodyweight-temp', async (req, res) => {
      const {
          mouse_id, timepoints, wellnessScores, hqpbodyweighttempdataentryemail, hqpbodyweightandtempcheckemail,
          temperatureDevice, lubricant, complication, thermometerCleaned,humaneEndpoint, humaneEndpointCriteria,
          deviations, comments
      } = req.body;
  
      try {
          // Convert wellnessScores to JSONB format
          const wellnessScoresJson = JSON.stringify(wellnessScores);
  
          // Update mouse_npsp table with general data and wellness scores in JSONB format
          await pool.query(`
            UPDATE mouse_npsp
            SET 
              body_weight_t0 = $1, temperature_t0 = $2, 
              body_weight_t4 = $3, temperature_t4 = $4,
              body_weight_t8 = $5, temperature_t8 = $6,
              wellness_scores = $7::jsonb, -- Store wellness scores as JSONB
              hqp_bodyweight_temp_entry_email = $8, hqp_bodyweight_temp_check_email = $9,
              temperature_device_used = $10, lubricant_used = $11, temperature_complications = $12,
              thermometer_cleaned = $13, humane_endpoint = $14, humane_endpoint_criteria = $15, deviations_bodyweight_temp = $16,
              comments_bodyweight_temp = $17
            WHERE mouse_id = $18
          `, [
            timepoints[0].bodyWeight, timepoints[0].temperature, // Corresponds to T0
            timepoints[1].bodyWeight, timepoints[1].temperature, // Corresponds to T4
            timepoints[2].bodyWeight, timepoints[2].temperature, // Corresponds to T8
            wellnessScoresJson,
            hqpbodyweighttempdataentryemail, hqpbodyweightandtempcheckemail,
            temperatureDevice, lubricant, complication, thermometerCleaned,humaneEndpoint, humaneEndpointCriteria,
            deviations, comments, mouse_id
          ]);
  
          res.status(200).json({ message: 'Bodyweight, Temperature, and Wellness scores updated successfully.' });
      } catch (error) {
          console.error('Error updating Bodyweight and Temperature details:', error);
          res.status(500).json({ error: 'Failed to update details', details: error.message });
      }
  });
  

    app.get('/api/mouse-details/:mouseId', async (req, res) => {
      const { mouseId } = req.params;
      
      try {
        const result = await pool.query(
          'SELECT wellness_scores FROM mouse_npsp WHERE mouse_id = $1',
          [mouseId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Mouse not found' });
        }

        const wellnessScores = result.rows[0].wellness_scores;
        res.json({ wellnessScores });
      } catch (error) {
        console.error('Error fetching wellness scores:', error);
        res.status(500).json({ error: 'Failed to fetch wellness scores' });
      }
    });

    app.put('/api/mouse-details/syringe-prep', async (req, res) => {
      try {
          const mouseDetailsArray = req.body;
  
          for (const mouseDetails of mouseDetailsArray) {
              await pool.query(`
                  UPDATE mouse_npsp
                  SET 
                      mouse_number_t1 = $1, 
                      fecal_slurry_dextrose_volume = $2,
                      syringe_number_t1 = $3, 
                      hqp_syringe_prep_data_entry_email = $4,
                      hqp_unblinded_syringe_prep_email = $5, 
                      time_of_first_injection = $6,
                      fecal_slurry_source = $7, 
                      fecal_slurry_concentration = $8,
                      vehicle_used = $9, 
                      number_of_frozen_fecal_slurry_1ml = $10,
                      number_of_frozen_fecal_slurry_3ml = $11, 
                      number_of_frozen_fecal_slurry_5ml = $12,
                      fecal_slurry_processing = $13, 
                      fecal_slurry_to_dextrose_ratio = $14,
                      fecal_slurry_mixing_method = $15, 
                      syringe_diluted_fecal_slurry_loaded = $16,
                      syringe_size_and_needle = $17, 
                      needle_color = $18,
                      syringe_covering = $19, 
                      syringe_labeling_correct = $20, 
                      needle_dead_space_technique = $21
                  WHERE mouse_id = $22
              `, [
                  mouseDetails.mouse_number_t1,
                  parseFloat(mouseDetails.fecal_slurry_dextrose_volume) || 0,
                  parseInt(mouseDetails.syringe_number_t1) || 0,
                  mouseDetails.hqp_syringe_prep_data_entry_email,
                  mouseDetails.hqp_unblinded_syringe_prep_email,
                  mouseDetails.time_of_first_injection,
                  mouseDetails.fecal_slurry_source,
                  mouseDetails.fecal_slurry_concentration,
                  mouseDetails.vehicle_used,
                  parseInt(mouseDetails.number_of_frozen_fecal_slurry_1ml, 10) || 0,
                  parseInt(mouseDetails.number_of_frozen_fecal_slurry_3ml, 10) || 0,
                  parseInt(mouseDetails.number_of_frozen_fecal_slurry_5ml, 10) || 0,
                  mouseDetails.fecal_slurry_processing,
                  mouseDetails.fecal_slurry_to_dextrose_ratio,
                  mouseDetails.fecal_slurry_mixing_method,
                  mouseDetails.syringe_diluted_fecal_slurry_loaded,
                  mouseDetails.syringe_size_and_needle,
                  mouseDetails.needle_color,
                  mouseDetails.syringe_covering,
                  mouseDetails.syringe_labeling_correct,
                  mouseDetails.needle_dead_space_technique,
                  mouseDetails.mouse_id
              ]);
          }
          res.status(200).json({ message: 'Syringe Prep TMinusOne details updated successfully' });
      } catch (error) {
          console.error("Error in Syringe Prep TMinusOne update:", error);
          res.status(500).json({ error: 'Failed to update details', details: error.message });
      }
  });
  
  app.put('/api/mouse-details/syringe-prep-tthree', async (req, res) => {
    try {
        const mouseDetailsArray = req.body;

        for (const mouseDetails of mouseDetailsArray) {
            await pool.query(`
                UPDATE mouse_npsp
                SET 
                    mouse_number_t3 = $1, 
                    total_injectable_volume = $2,
                    syringe_number_t3 = $3, 
                    antibiotic_resuspension_time = $4,
                    time_first_injection_t3 = $5,
                    time_last_injection_t3= $6,
                    antibiotic_used = $7, 
                    buprenorphine_dilution = $8,
                    imipenem_cilastatin_dilution = $9,
                    syringe_storage_condition = $10,
                    protocol_deviations_t3 = $11, 
                    syringe_prep_comments_t3 = $12,
                    buprenorphine_concentration = $13,
                    antibiotic_timing_within_4_hours = $14,
                    antibiotic_dissolution_confirmation = $15,
                    antibiotic_preparation_confirmation = $16
                WHERE mouse_id = $17
            `, [
                mouseDetails.mouse_number_t3,
                parseFloat(mouseDetails.total_injectable_volume, 10) || 0,
                parseInt(mouseDetails.syringe_number_t3, 10) || 0,
                mouseDetails.antibiotic_resuspension_time,
                mouseDetails.time_first_injection_t3,
                mouseDetails.time_last_injection_t3,
                mouseDetails.antibiotic_used,
                mouseDetails.buprenorphine_dilution,
                mouseDetails.imipenem_cilastatin_dilution,
                mouseDetails.syringe_storage_condition,
                mouseDetails.protocol_deviations_t3,
                mouseDetails.syringe_prep_comments_t3,
                mouseDetails.buprenorphine_concentration,
                mouseDetails.antibiotic_timing_within_4_hours,
                mouseDetails.antibiotic_dissolution_confirmation,
                mouseDetails.antibiotic_preparation_confirmation,
                mouseDetails.mouse_id
            ]);
        }
        res.status(200).json({ message: 'Syringe Prep TThree details updated successfully' });
    } catch (error) {
        console.error("Error in Syringe Prep TThree update:", error);
        res.status(500).json({ error: 'Failed to update details', details: error.message });
    }
});


app.get('/api/mouse-details/syringe-prep-tminusone/:mouseId', async (req, res) => {
  const { mouseId } = req.params;

  try {
      const result = await pool.query(`
          SELECT 
              mouse_number_t1,
              fecal_slurry_dextrose_volume,
              syringe_number_t1,
              hqp_syringe_prep_data_entry_email,
              hqp_unblinded_syringe_prep_email,
              time_of_first_injection,
              fecal_slurry_source,
              fecal_slurry_concentration,
              vehicle_used,
              number_of_frozen_fecal_slurry_1ml,
              number_of_frozen_fecal_slurry_3ml,
              number_of_frozen_fecal_slurry_5ml,
              fecal_slurry_processing,
              fecal_slurry_to_dextrose_ratio,
              fecal_slurry_mixing_method,
              syringe_diluted_fecal_slurry_loaded,
              syringe_size_and_needle,
              needle_color,
              syringe_covering,
              syringe_labeling_correct,
              needle_dead_space_technique
          FROM mouse_npsp
          WHERE mouse_id = $1
      `, [mouseId]);

      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Mouse not found' });
      }

      res.status(200).json(result.rows[0]);
  } catch (error) {
      console.error('Error fetching Syringe Prep TMinusOne data:', error);
      res.status(500).json({ error: 'Failed to fetch Syringe Prep TMinusOne data' });
  }
});

app.get('/api/mouse-details/syringe-prep-tthree/:mouseId', async (req, res) => {
  const { mouseId } = req.params;

  try {
      const result = await pool.query(`
          SELECT 
              mouse_number_t3,
              total_injectable_volume,
              syringe_number_t3,
              antibiotic_resuspension_time,
              time_first_injection_t3,
              time_last_injection_t3,
              antibiotic_used,
              buprenorphine_dilution,
              imipenem_cilastatin_dilution,
              syringe_storage_condition,
              protocol_deviations_t3,
              syringe_prep_comments_t3,
              buprenorphine_concentration,
              antibiotic_timing_within_4_hours,
              antibiotic_dissolution_confirmation,
              antibiotic_preparation_confirmation
          FROM mouse_npsp
          WHERE mouse_id = $1
      `, [mouseId]);

      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Mouse not found' });
      }

      res.status(200).json(result.rows[0]);
  } catch (error) {
      console.error('Error fetching Syringe Prep TThree data:', error);
      res.status(500).json({ error: 'Failed to fetch Syringe Prep TThree data' });
  }
});

// put API route to handle Induction Form data submission
app.put('/api/mouse-details/induction-form', async (req, res) => {
  const mouseDetails = req.body; 
  console.log("Received induction form data:", mouseDetails); 
  try {
    // Ensure that the `mouse_npsp` table has all fields matching the form data
    const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
    if (mouseExists.rowCount === 0) {
      console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
      return res.status(404).json({ error: 'Mouse not found' });
    }

    await pool.query(
      `UPDATE mouse_npsp
       SET 
         hqp_induction_data_entry_email = $1,
         hqp_induction_check_email = $2,
         hqp_syringe_prep_email = $3,
         hqp_wellness_check_t1_email = $4,
         hqp_injection_t0_email = $5,
         sepsis_induction_syringe_number = $6,
         syringe_preparation_date = $7,
         changed_to_conventional_housing = $8,
         mouse_anesthesia_method = $9,
         abdomen_massage_duration = $10,
         sepsis_induction_time = $11,
         injection_method = $12,
         plunger_retraction_observations = $13,
         anesthesia_injection_issues = $14,
         injections_staggered = $15,
         staggered_injection_interval = $16,
         injection_needle_color = $17,
         post_injection_cage_placement = $18,
         cage_warm_maintenance = $19,
         induction_protocol_deviations = $20,
         induction_comments = $21
       WHERE mouse_id = $22
      `,
      [
        mouseDetails.hqp_induction_data_entry_email,
        mouseDetails.hqp_induction_check_email,
        mouseDetails.hqp_syringe_prep_email,
        mouseDetails.hqp_wellness_check_t1_email,
        mouseDetails.hqp_injection_t0_email,
        mouseDetails.sepsis_induction_syringe_number,
        mouseDetails.syringe_preparation_date,
        mouseDetails.changed_to_conventional_housing,
        mouseDetails.mouse_anesthesia_method,
        mouseDetails.abdomen_massage_duration,
        mouseDetails.sepsis_induction_time,
        mouseDetails.injection_method,
        mouseDetails.plunger_retraction_observations,
        mouseDetails.anesthesia_injection_issues,
        mouseDetails.injections_staggered,
        mouseDetails.staggered_injection_interval,
        mouseDetails.injection_needle_color,
        mouseDetails.post_injection_cage_placement,
        mouseDetails.cage_warm_maintenance,
        mouseDetails.induction_protocol_deviations,
        mouseDetails.induction_comments,
        mouseDetails.mouse_id
      ]
    );
  
    res.status(200).json({ message: 'Induction form data saved successfully' });
  } catch (error) {
    console.error('Error saving induction form data:', error);
    
    res.status(500).json({ error: 'Failed to save induction form data' });
  }
});

app.get('/api/induction-form/:mouseId', async (req, res) => {
  const { mouseId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT 
         hqp_induction_data_entry_email,
         hqp_induction_check_email,
         hqp_syringe_prep_email,
         hqp_wellness_check_t1_email,
         hqp_injection_t0_email,
         sepsis_induction_syringe_number,
         syringe_preparation_date,
         changed_to_conventional_housing,
         mouse_anesthesia_method,
         abdomen_massage_duration,
         sepsis_induction_time,
         injection_method,
         plunger_retraction_observations,
         anesthesia_injection_issues,
         injections_staggered,
         staggered_injection_interval,
         injection_needle_color,
         post_injection_cage_placement,
         cage_warm_maintenance,
         induction_protocol_deviations,
         induction_comments
       FROM mouse_npsp 
       WHERE mouse_id = $1`, 
      [mouseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Mouse not found' });
    }

    res.status(200).json({ formData: result.rows[0] });
  } catch (error) {
    console.error('Error fetching induction form data:', error);
    res.status(500).json({ error: 'Failed to fetch induction form data' });
  }
});

app.put('/api/mouse-details/treatment-injection', async (req, res) => {
  const mouseDetails = req.body; 
  console.log("Received treatment injection form data:", mouseDetails); 
  
  try {
    // Ensure that the `mouse_npsp` table has all fields matching the form data
    const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
    if (mouseExists.rowCount === 0) {
      console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
      return res.status(404).json({ error: 'Mouse not found' });
    }

    await pool.query(
      `UPDATE mouse_npsp
       SET 
         hqp_treatment_injection_data_entry_email = $1,
         hqp_treatment_injection_check_email = $2,
         hqp_treatment_syringe_prep_email = $3,
         treatment_syringe_number = $4,
         hqp_injected_treatment_email = $5,
         treatment_injection_time = $6,
         treatment_injection_administration = $7,
         treatment_route_administration = $8,
         treatment_injection_done_correctly = $9,
         treatment_injection_issues = $10,
         treatment_syringe_type = $11,
         treatment_protocol_deviations = $12,
         treatment_comments = $13
       WHERE mouse_id = $14
      `,
      [
        mouseDetails.hqp_treatment_injection_data_entry_email,
        mouseDetails.hqp_treatment_injection_check_email,
        mouseDetails.hqp_treatment_syringe_prep_email,
        mouseDetails.treatment_syringe_number,
        mouseDetails.hqp_injected_treatment_email,
        mouseDetails.treatment_injection_time,
        mouseDetails.treatment_injection_administration,
        mouseDetails.treatment_route_administration,
        mouseDetails.treatment_injection_done_correctly,
        mouseDetails.treatment_injection_issues,
        mouseDetails.treatment_syringe_type,
        mouseDetails.treatment_protocol_deviations,
        mouseDetails.treatment_comments,
        mouseDetails.mouse_id
      ]
    );
  
    res.status(200).json({ message: 'Treatment injection form data saved successfully' });
  } catch (error) {
    console.error('Error saving treatment injection form data:', error);
    res.status(500).json({ error: 'Failed to save treatment injection form data' });
  }
});

app.get('/api/treatment-injection/:mouseId', async (req, res) => {
  const { mouseId } = req.params;
  console.log('Received mouseId:', mouseId);
  try {
    const result = await pool.query(
       `SELECT 
        hqp_treatment_injection_data_entry_email,
        hqp_treatment_injection_check_email,
        hqp_treatment_syringe_prep_email,
        treatment_syringe_number,
        hqp_injected_treatment_email,
        treatment_injection_time,
        treatment_injection_administration,
        treatment_route_administration,
        treatment_injection_done_correctly,
        treatment_injection_issues,
        treatment_syringe_type,
        treatment_protocol_deviations,
        treatment_comments
      FROM mouse_npsp
      WHERE mouse_id = $1`,
      [mouseId]
    );
    console.log('Query Result:', result.rows);
    
    if (result.rowCount=== 0) {
      return res.status(404).json({ error: "No data found for the given mouse_id." });
    }

    res.status(200).json({ formData: result.rows[0] });
  } catch (error) {
    console.error("Error fetching treatment injection data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put('/api/mouse-details/epoc-form', async (req, res) => {
  const mouseDetails = req.body;
  console.log("Received EPOC form data:", mouseDetails);

  try {
      const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
      if (mouseExists.rowCount === 0) {
          console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
          return res.status(404).json({ error: 'Mouse not found' });
      }

      await pool.query(
          `UPDATE mouse_npsp
           SET 
              epoc_card_expiry_date = $1,
              epoc_card_lot_number = $2,
              epoc_machine_backdated = $3,
              hqp_epoc_sample_injection_email = $4,
              epoc_sample_injection_time = $5,
              hqp_epoc_check_email = $6,
              hqp_epoc_data_entry_email = $7,
              hqp_epoc_verification_email = $8,
              epoc_run_status = $9, 
              epoc_ph = $10,
              epoc_pco2 = $11,
              epoc_po2 = $12,
              epoc_chco3 = $13,
              epoc_be_ecf = $14,
              epoc_be_b = $15,
              epoc_cso2 = $16,
              epoc_na = $17,
              epoc_k = $18,
              epoc_ca = $19,
              epoc_cl = $20,
              epoc_hct = $21,
              epoc_chgb = $22,
              epoc_glu = $23,
              epoc_lac = $24,
              epoc_bun = $25,
              epoc_urea = $26,
              epoc_crea = $27,
              epoc_picture_upload_confirmation = $28,
              epoc_data_entry_confirmation = $29,
              epoc_protocol_deviations = $30,
              epoc_comments = $31
          WHERE mouse_id = $32
          `,
          [
            mouseDetails.epoc_card_expiry_date,
            mouseDetails.epoc_card_lot_number,
            mouseDetails.epoc_machine_backdated,
            mouseDetails.hqp_epoc_sample_injection_email,
            mouseDetails.epoc_sample_injection_time,
            mouseDetails.hqp_epoc_check_email,
            mouseDetails.hqp_epoc_data_entry_email,
            mouseDetails.hqp_epoc_verification_email,
            mouseDetails.epoc_run_status,
            mouseDetails.epoc_ph,
            mouseDetails.epoc_pco2,
            mouseDetails.epoc_po2,
            mouseDetails.epoc_chco3,
            mouseDetails.epoc_be_ecf,
            mouseDetails.epoc_be_b,
            mouseDetails.epoc_cso2,
            mouseDetails.epoc_na,
            mouseDetails.epoc_k,
            mouseDetails.epoc_ca,
            mouseDetails.epoc_cl,
            mouseDetails.epoc_hct,
            mouseDetails.epoc_chgb,
            mouseDetails.epoc_glu,
            mouseDetails.epoc_lac,
            mouseDetails.epoc_bun,
            mouseDetails.epoc_urea,
            mouseDetails.epoc_crea,
            mouseDetails.epoc_picture_upload_confirmation,
            mouseDetails.epoc_data_entry_confirmation,
            mouseDetails.epoc_protocol_deviations,
            mouseDetails.epoc_comments,
            mouseDetails.mouse_id
          ]
      );

      res.status(200).json({ message: 'EPOC form data saved successfully' });
  } catch (error) {
      console.error('Error saving EPOC form data:', error);
      res.status(500).json({ error: 'Failed to save EPOC form data' ,details: error.message });
  }
});

app.get('/api/epoc/:mouseId', async (req, res) => {
  const { mouseId } = req.params;

  try {
      const result = await pool.query(
          `SELECT 
              epoc_card_expiry_date,
              epoc_card_lot_number,
              epoc_machine_backdated,
              hqp_epoc_sample_injection_email,
              epoc_sample_injection_time,
              hqp_epoc_check_email,
              hqp_epoc_data_entry_email,
              hqp_epoc_verification_email,
              epoc_run_status,
              epoc_ph,
              epoc_pco2,
              epoc_po2,
              epoc_chco3,
              epoc_be_ecf,
              epoc_be_b,
              epoc_cso2,
              epoc_na,
              epoc_k,
              epoc_ca,
              epoc_cl,
              epoc_hct,
              epoc_chgb,
              epoc_glu,
              epoc_lac,
              epoc_bun,
              epoc_urea,
              epoc_crea,
              epoc_picture_upload_confirmation,
              epoc_data_entry_confirmation,
              epoc_protocol_deviations,
              epoc_comments
          FROM mouse_npsp
          WHERE mouse_id = $1`,
          [mouseId]
      );

      if (result.rowCount === 0) {
          return res.status(404).json({ error: "No data found for the given mouse_id." });
      }

      res.status(200).json({ formData: result.rows[0] });
  } catch (error) {
      console.error("Error fetching EPOC form data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

// API route to handle Biobanking form data submission
app.put('/api/mouse-details/biobanking-form', async (req, res) => {
  const mouseDetails = req.body; 
  console.log("Received biobanking form data:", mouseDetails);

  try {
      // Check if the mouse record exists in the database
      const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
      if (mouseExists.rowCount === 0) {
          console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
          return res.status(404).json({ error: 'Mouse not found' });
      }
      const textFields = [
        'brain_dissection', 'lung_dissection', 'heart_dissection',
        'liver_dissection', 'spleen_dissection', 'kidney_dissection',
        'muscle_dissection', 'cecal_contents_dissection', 'biobanking_completed_organs'
      ];
  
      textFields.forEach(field => {
        if (Array.isArray(mouseDetails[field])) {
          mouseDetails[field] = mouseDetails[field].join(', '); // Convert array to string
        }
      });
  
      // Update the mouse_npsp table with the Biobanking form fields
      await pool.query(
          `UPDATE mouse_npsp
           SET 
              hqp_biobanking_data_entry_email = $1,
              hqp_biobanking_check_email = $2,
              hqp_tissue_sectioning_email = $3,
              biobanking_isoflurane_induction_time = $4,
              biobanking_isoflurane_percentage_induction = $5,
              biobanking_isoflurane_percentage_nose_cone = $6,
              biobanking_anesthesia_check_method = $7,
              mouse_cleaned_with_ethanol = $8,
              carotid_blood_collection_time = $9,
              hqp_carotid_blood_collection_email = $10,
              blood_collection_tube_type = $11,
              blood_collected_volume = $12,
              blood_collection_difficulties = $13::jsonb,
              blood_collection_inverted = $14,
              blood_sample_storage = $15,
              epoc_analysis_outcome = $16,
              plf_pbs_injection_volume = $17,
              plf_injection_needle_size = $18,
              plf_massaged = $19,
              plf_collected_volume = $20,
              plf_sample_storage_temperature = $21,
              plf_sample_appearance = $22::jsonb,
              plf_picture_uploaded = $23,
              plf_complications = $24,
              plf_complication_details = $25,
              freezing_agent = $26,
              brain_dissection = $27,
              hqp_brain_dissection_email = $28,
              lung_dissection = $29,
              hqp_lung_dissection_email = $30,
              heart_dissection = $31,
              hqp_heart_dissection_email = $32,
              liver_dissection = $33,
              hqp_liver_dissection_email = $34,
              spleen_dissection = $35,
              hqp_spleen_dissection_email = $36,
              kidney_dissection = $37,
              kidney_decapsulated = $38,
              hqp_kidney_dissection_email = $39,
              muscle_dissection = $40,
              hqp_muscle_dissection_email = $41,
              cecal_contents_dissection = $42,
              hqp_cecal_contents_collection_email = $43,
              biobanking_completed_organs = $44,
              dissection_complications_organs = $45,
              dissection_complications_explanation = $46::jsonb,
              centrifuge_type = $47,
              blood_centrifugation_conditions = $48,
              eve_biomarker_analysis_samples = $49,
              eve_technologies_aliquot_volume = $50,
              eve_technology_sample_id = $51,
              custom_aliquot_volumes = $52,
              plf_aliquots_before_centrifugation = $53,
              number_of_plf_aliquots = $54,
              plf_centrifugation_conditions = $55,
              plf_supernatant_aliquots = $56,
              number_of_aliquots = $57,
              rnalater_transfer_to_80 = $58,
              snap_freeze_storage_location = $59,
              falcon_tube_temp = $60,
              falcon_tube_shaken = $61,
              formalin_fixation_time = $62,      
              formalin_fixation_exact_time = $63,
              pbs_wash_after_formalin = $64,
              long_term_storage_options = $65::jsonb,
              sample_storage_temperature = $66,
              protocol_deviations_biobanking = $67,
              biobanking_comments = $68
              
      
           WHERE mouse_id = $69
          `,
          [
              mouseDetails.hqp_biobanking_data_entry_email,
              mouseDetails.hqp_biobanking_check_email,
              mouseDetails.hqp_tissue_sectioning_email,
              mouseDetails.biobanking_isoflurane_induction_time,
              mouseDetails.biobanking_isoflurane_percentage_induction,
              mouseDetails.biobanking_isoflurane_percentage_nose_cone,
              mouseDetails.biobanking_anesthesia_check_method,
              mouseDetails.mouse_cleaned_with_ethanol,
              mouseDetails.carotid_blood_collection_time,
              mouseDetails.hqp_carotid_blood_collection_email,
              mouseDetails.blood_collection_tube_type,
              mouseDetails.blood_collected_volume,
              JSON.stringify(mouseDetails.blood_collection_difficulties || []),
              mouseDetails.blood_collection_inverted,
              mouseDetails.blood_sample_storage,
              mouseDetails.epoc_analysis_outcome,
              mouseDetails.plf_pbs_injection_volume,
              mouseDetails.plf_injection_needle_size,
              mouseDetails.plf_massaged,
              mouseDetails.plf_collected_volume,
              mouseDetails.plf_sample_storage_temperature,
              JSON.stringify(mouseDetails.plf_sample_appearance || []),
              mouseDetails.plf_picture_uploaded,
              mouseDetails.plf_complications,
              mouseDetails.plf_complication_details,
              mouseDetails.freezing_agent,
              mouseDetails.brain_dissection,
              mouseDetails.hqp_brain_dissection_email,
              mouseDetails.lung_dissection,
              mouseDetails.hqp_lung_dissection_email,
              mouseDetails.heart_dissection,
              mouseDetails.hqp_heart_dissection_email,
              mouseDetails.liver_dissection,
              mouseDetails.hqp_liver_dissection_email,
              mouseDetails.spleen_dissection,
              mouseDetails.hqp_spleen_dissection_email,
              mouseDetails.kidney_dissection,
              mouseDetails.kidney_decapsulated,
              mouseDetails.hqp_kidney_dissection_email,
              mouseDetails.muscle_dissection,
              mouseDetails.hqp_muscle_dissection_email,
              mouseDetails.cecal_contents_dissection,
              mouseDetails.hqp_cecal_contents_collection_email,
              mouseDetails.biobanking_completed_organs,
              mouseDetails.dissection_complications_organs,
              mouseDetails.dissection_complications_explanation,
              mouseDetails.centrifuge_type,
              mouseDetails.blood_centrifugation_conditions,
              mouseDetails.eve_biomarker_analysis_samples,
              mouseDetails.eve_technologies_aliquot_volume,
              mouseDetails.eve_technology_sample_id,
              mouseDetails.custom_aliquot_volumes,
              mouseDetails.plf_aliquots_before_centrifugation,
              mouseDetails.number_of_plf_aliquots,
              mouseDetails.plf_centrifugation_conditions,
              mouseDetails.plf_supernatant_aliquots,
              mouseDetails.number_of_aliquots,
              mouseDetails.rnalater_transfer_to_80,
              mouseDetails.snap_freeze_storage_location,
              mouseDetails.falcon_tube_temp,
              mouseDetails.falcon_tube_shaken,
              mouseDetails.formalin_fixation_time,
              mouseDetails.formalin_fixation_exact_time,
              mouseDetails.pbs_wash_after_formalin,
              JSON.stringify(mouseDetails.long_term_storage_options || []),
              mouseDetails.sample_storage_temperature,
              mouseDetails.protocol_deviations_biobanking,
              mouseDetails.biobanking_comments,
              mouseDetails.mouse_id
          ]
      );

      res.status(200).json({ message: 'Biobanking form data saved successfully' });
  } catch (error) {
      console.error('Error saving Biobanking form data:', error);
      res.status(500).json({ error: 'Failed to save Biobanking form data', details: error.message });
  }
});

app.get('/api/biobanking-form/:mouseId', async (req, res) => {
  const { mouseId } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        hqp_biobanking_data_entry_email,
        hqp_biobanking_check_email,
        hqp_tissue_sectioning_email,
        biobanking_isoflurane_induction_time,
        biobanking_isoflurane_percentage_induction,
        biobanking_isoflurane_percentage_nose_cone,
        biobanking_anesthesia_check_method,
        mouse_cleaned_with_ethanol,
        carotid_blood_collection_time,
        hqp_carotid_blood_collection_email,
        blood_collection_tube_type,
        blood_collected_volume,
        blood_collection_difficulties,
        blood_collection_inverted,
        blood_sample_storage,
        epoc_analysis_outcome,
        plf_pbs_injection_volume,
        plf_injection_needle_size,
        plf_massaged,
        plf_collected_volume,
        plf_sample_storage_temperature,
        plf_sample_appearance,
        plf_picture_uploaded,
        plf_complications,
        plf_complication_details,
        freezing_agent,
        brain_dissection,
        hqp_brain_dissection_email,
        lung_dissection,
        hqp_lung_dissection_email,
        heart_dissection,
        hqp_heart_dissection_email,
        liver_dissection,
        hqp_liver_dissection_email,
        spleen_dissection,
        hqp_spleen_dissection_email,
        kidney_dissection,
        kidney_decapsulated,
        hqp_kidney_dissection_email,
        muscle_dissection,
        hqp_muscle_dissection_email,
        cecal_contents_dissection,
        hqp_cecal_contents_collection_email,
        biobanking_completed_organs,
        dissection_complications_organs,
        dissection_complications_explanation,
        centrifuge_type,
        blood_centrifugation_conditions,
        eve_biomarker_analysis_samples,
        eve_technologies_aliquot_volume,
        eve_technology_sample_id,
        custom_aliquot_volumes,
        plf_aliquots_before_centrifugation,
        number_of_plf_aliquots,
        plf_centrifugation_conditions,
        plf_supernatant_aliquots,
        number_of_aliquots,
        rnalater_transfer_to_80,
        snap_freeze_storage_location,
        falcon_tube_temp,
        falcon_tube_shaken,
        formalin_fixation_time,
        formalin_fixation_exact_time,
        pbs_wash_after_formalin,
        long_term_storage_options,
        sample_storage_temperature,
        protocol_deviations_biobanking,
        biobanking_comments
      FROM mouse_npsp
      WHERE mouse_id = $1`,
      [mouseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No data found for the given mouse_id." });
    }



    let formData = result.rows[0];

    // Convert stored strings back into arrays for frontend usage
    const textFields = [
      'brain_dissection', 'lung_dissection', 'heart_dissection',
      'liver_dissection', 'spleen_dissection', 'kidney_dissection',
      'muscle_dissection', 'cecal_contents_dissection', 'biobanking_completed_organs'
    ];

    textFields.forEach(field => {
      if (formData[field]) {
        formData[field] = formData[field].split(', '); // Convert string to array
      } else {
        formData[field] = [];
      }
    });


    res.status(200).json({ formData });
  } catch (error) {
    console.error("Error fetching biobanking form data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// server.js
app.put('/api/mouse-details/wbc-count', async (req, res) => {
  const mouseDetails = req.body;
  console.log("Received WBC Count form data:", mouseDetails);

  try {
    // Check if the mouse record exists in the database
    const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
    if (mouseExists.rowCount === 0) {
      console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
      return res.status(404).json({ error: 'Mouse not found' });
    }

    // Update the database with WBC count data
    await pool.query(
      `UPDATE mouse_npsp
       SET 
         hqp_data_entry_wbc_email = $1,
         hqp_wbc_table_email = $2,
         wbc_count_conducted = $3,
         reason_not_counted = $4,
         wbc_count_time = $5,
         wbc_dye_used = $6,
         blood_sample_quality = $7,
         npsp_sop_followed = $8,
         made_changes_sop = $9,
         not_sure = $10,
         wbc_count_method = $11,
         wbc_count_corner1 = $12,
         wbc_count_corner2 = $13,
         wbc_count_corner3 = $14,
         wbc_count_corner4 = $15,
         wbc_total_cells = $16,
         wbc_cell_concentration = $17,
         wbc_protocol_deviations = $18,
         wbc_comments = $19
       WHERE mouse_id = $20`,
      [
        mouseDetails.hqp_data_entry_wbc_email,
        mouseDetails.hqp_wbc_table_email,
        mouseDetails.wbc_count_conducted,
        mouseDetails.reason_not_counted,
        mouseDetails.wbc_count_time,
        mouseDetails.wbc_dye_used,
        mouseDetails.blood_sample_quality,
        mouseDetails.npsp_sop_followed,
        mouseDetails.made_changes_sop,
        mouseDetails.not_sure,
        mouseDetails.wbc_count_method,
        mouseDetails.wbc_count_corner1,
        mouseDetails.wbc_count_corner2,
        mouseDetails.wbc_count_corner3,
        mouseDetails.wbc_count_corner4,
        mouseDetails.wbc_total_cells,
        mouseDetails.wbc_cell_concentration,
        mouseDetails.wbc_protocol_deviations,
        mouseDetails.wbc_comments,
        mouseDetails.mouse_id,
      ]
    );

    res.status(200).json({ message: 'WBC Count data updated successfully' });
  } catch (error) {
    console.error('Error updating WBC Count data:', error);
    res.status(500).json({ error: 'Failed to update WBC Count data' });
  }
});

app.get('/api/wbc-count/:mouseId', async (req, res) => {
  const { mouseId } = req.params;
  console.log(`Fetching WBC Count data for Mouse ID: ${mouseId}`);

  try {
    const result = await pool.query(
      `SELECT 
         hqp_data_entry_wbc_email,
         hqp_wbc_table_email,
         wbc_count_conducted,
         reason_not_counted,
         wbc_count_time,
         wbc_dye_used,
         blood_sample_quality,
         npsp_sop_followed,
         made_changes_sop,
         not_sure,
         wbc_count_method,
         wbc_count_corner1,
         wbc_count_corner2,
         wbc_count_corner3,
         wbc_count_corner4,
         wbc_total_cells,
         wbc_cell_concentration,
         wbc_protocol_deviations,
         wbc_comments
       FROM mouse_npsp
       WHERE mouse_id = $1`,
      [mouseId]
    );

    if (result.rowCount === 0) {
      console.error(`Mouse ID ${mouseId} not found`);
      return res.status(404).json({ error: 'Mouse not found' });
    }

    console.log("Fetched WBC data:", result.rows[0]);
    res.status(200).json({ formData: result.rows[0] });
  } catch (error) {
    console.error('Error fetching WBC Count data:', error);
    res.status(500).json({ error: 'Failed to fetch WBC Count data' });
  }
});




app.put('/api/mouse-details/bacterial-culture-initial', async (req, res) => {
  const mouseDetails = req.body;
  console.log("Received Bacterial Culture form data:", mouseDetails);

  try {
    // Check if the mouse record exists in the database
    const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
    if (mouseExists.rowCount === 0) {
      console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
      return res.status(404).json({ error: 'Mouse not found' });
    }

    // Update the database with bacterial culture data
    await pool.query(
      `UPDATE mouse_npsp
       SET 
         hqp_culture_data_entry_email = $1,
         hqp_culture_check_email = $2,
         hqp_biobanking_placing_samples = $3,
         blood_agar_plate_type = $4,
         dilution_preparation_location = $5,
         blood_plf_dilution_agent = $6,
         incubator_type = $7,
         blood_agar_plate_placement_time = $8,
         incubator_temperature = $9
       WHERE mouse_id = $10`,
      [
        mouseDetails.hqp_culture_data_entry_email,
        mouseDetails.hqp_culture_check_email,
        mouseDetails.hqp_biobanking_placing_samples,
        mouseDetails.blood_agar_plate_type,
        mouseDetails.dilution_preparation_location,
        mouseDetails.blood_plf_dilution_agent,
        mouseDetails.incubator_type,
        mouseDetails.blood_agar_plate_placement_time,
        mouseDetails.incubator_temperature,
        mouseDetails.mouse_id,
      ]
    );
        res.status(200).json({ message: 'Bacterial Culture data updated successfully' });
      } catch (error) {
        console.error('Error updating Bacterial Culture data:', error);
        res.status(500).json({ error: 'Failed to update Bacterial Culture data' });
      }
    });

    app.put('/api/mouse-details/bacterial-count-24hr', async (req, res) => {
      const mouseDetails = req.body;
  
      try {
          console.log("Received data:", mouseDetails);  // Log received data for debugging
  
          const mouseExists = await pool.query('SELECT 1 FROM mouse_npsp WHERE mouse_id = $1', [mouseDetails.mouse_id]);
          if (mouseExists.rowCount === 0) {
              console.error(`Mouse ID ${mouseDetails.mouse_id} not found`);
              return res.status(404).json({ error: 'Mouse not found' });
          }
  
          const updateQuery = `
              UPDATE mouse_npsp SET
                  blood_dilution_counts = $1::jsonb,
                  plf_dilution_counts = $2::jsonb,
                  highest_blood_dilution_tried = $3,
                  highest_dilution_plf_tried = $4,
                  whole_blood_cfu_ml = $5,
                  plf_cfu_ml = $6,
                  colony_count_date = $7::date,
                  colony_count_time = $8::time,
                  hqp_colony_count_email = $9,
                  hqp_biobanking_placing_samples_24_hours = $10,
                  plf_replate_needed = $11,
                  replating_hqp = $12,
                  plates_uploaded_to_sharepoint = $13::boolean,
                  protocol_deviations_details = $14,
                  bacterial_culture_comments = $15
              WHERE mouse_id = $16
          `;
  
          const values = [
              mouseDetails.blood_dilution_counts,
              mouseDetails.plf_dilution_counts,
              mouseDetails.highest_blood_dilution_tried,
              mouseDetails.highest_dilution_plf_tried,
              mouseDetails.whole_blood_cfu_ml,
              mouseDetails.plf_cfu_ml,
              mouseDetails.colony_count_date,
              mouseDetails.colony_count_time,
              mouseDetails.hqp_colony_count_email,
              mouseDetails.hqp_biobanking_placing_samples_24_hours,
              mouseDetails.plf_replate_needed,
              mouseDetails.replating_hqp,
              mouseDetails.plates_uploaded_to_sharepoint,
              mouseDetails.protocol_deviations_details,
              mouseDetails.bacterial_culture_comments,
              mouseDetails.mouse_id
          ];
  
          console.log("Data values for update:", values);  // Log values for debugging
  
          await pool.query(updateQuery, values);
          res.status(200).json({ message: 'Bacterial count data updated successfully' });
      } catch (error) {
          console.error('Error updating bacterial count data:', error.message);
          console.error('Error details:', error);
          res.status(500).json({ error: 'Failed to update bacterial count data' });
      }
  });

  app.get('/api/bacterial-culture/:mouseId', async (req, res) => {
    const { mouseId } = req.params;
    console.log(`Fetching Bacterial Culture data for Mouse ID: ${mouseId}`);
  
    try {
      const result = await pool.query(
        `SELECT 
          hqp_culture_data_entry_email,
          hqp_culture_check_email,
          hqp_biobanking_placing_samples,
          blood_agar_plate_type,
          dilution_preparation_location,
          blood_plf_dilution_agent,
          incubator_type,
          blood_agar_plate_placement_time,
          incubator_temperature,
          colony_count_date,
          colony_count_time,
          hqp_colony_count_email,
          hqp_biobanking_placing_samples_24_hours,
          blood_dilution_counts,
          plf_dilution_counts,
          highest_blood_dilution_tried,
          highest_dilution_plf_tried,
          whole_blood_cfu_ml,
          plf_cfu_ml,
          plf_replate_needed,
          replating_hqp,
          plates_uploaded_to_sharepoint,
          protocol_deviations_details,
          bacterial_culture_comments
         FROM mouse_npsp
         WHERE mouse_id = $1`,
        [mouseId]
      );
  
      if (result.rowCount === 0) {
        console.error(`No data found for Mouse ID: ${mouseId}`);
        return res.status(404).json({ error: 'Mouse not found' });
      }
  
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching Bacterial Culture data:', error);
      res.status(500).json({ error: 'Failed to fetch Bacterial Culture data' });
    }
  });

  app.get('/api/mouse-allocation', async (req, res) => {
    try {
      // Query to fetch all mouse allocation details
      const result = await pool.query('SELECT * FROM mouse_allocation ORDER BY id ASC');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching mouse allocation details:', error);
      res.status(500).json({ error: 'Failed to fetch mouse allocation details' });
    }
  });
  
  app.put('/api/mouse-details/allocation-list', async (req, res) => {
    const { mouse_id, allocation_list } = req.body;
  
    try {
      if (!mouse_id || !allocation_list) {
        return res.status(400).json({ error: 'Mouse ID and Allocation List are required.' });
      }
  
      const result = await pool.query(
        'UPDATE mouse_npsp SET allocation_list = $1 WHERE mouse_id = $2',
        [allocation_list, mouse_id]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Mouse not found' });
      }
  
      res.status(200).json({ message: 'Allocation List updated successfully.' });
    } catch (error) {
      console.error('Error updating allocation list:', error);
      res.status(500).json({ error: 'Failed to update allocation list' });
    }
  });

  app.get('/api/mouse-allocation', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM allocated_mice ORDER BY id ASC');
        console.log('Allocated Mice Data:', result.rows); // Log the data
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching mouse allocation details:', error);
        res.status(500).json({ error: 'Failed to fetch mouse allocation details' });
    }
});
    // Serve static files from the React app
    app.use(express.static(path.join(__dirname, 'build')));

    // Handle React routing, return all requests to the React app
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });

    // Start the server

    app.listen(port, () => {
      console.log(`Server running on Heroku, port ${port}`);
    });