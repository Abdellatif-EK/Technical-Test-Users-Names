import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api';
const BATCH_SIZE = 1000;
const DEBOUNCE_TIME = 150; // Time in ms to wait before making a request

function App() {
  const [usersByLetter, setUsersByLetter] = useState({});
  const [alphabetIndex, setAlphabetIndex] = useState({});
  const [letterCounts, setLetterCounts] = useState({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [error, setError] = useState(null);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  
  const listRef = useRef(null);
  const infiniteLoaderRef = useRef(null);
  const requestCacheRef = useRef(new Set());
  const debounceTimerRef = useRef(null);
  const pendingRequestRef = useRef(null);

  // Fetch alphabet index and letter counts
  const fetchAlphabetData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/alphabet-index`);
      setAlphabetIndex(response.data.alphabetIndex);
      
      // Use the letter counts directly from the server
      if (response.data.letterCounts) {
        setLetterCounts(response.data.letterCounts);
      } else {
        // Fallback to the old method if server doesn't provide letter counts
        const counts = {};
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        alphabet.forEach(letter => {
          // Only set count for letters that actually exist in the index
          if (response.data.alphabetIndex[letter] !== undefined) {
            let count = 0;
            const currentIndex = response.data.alphabetIndex[letter];
            
            // Find the next letter with data
            let nextLetterIndex = alphabet.findIndex(l => l === letter) + 1;
            while (nextLetterIndex < alphabet.length) {
              const nextLetter = alphabet[nextLetterIndex];
              if (response.data.alphabetIndex[nextLetter] !== undefined) {
                count = response.data.alphabetIndex[nextLetter] - currentIndex;
                break;
              }
              nextLetterIndex++;
            }
            
            // If no next letter with data, count to the end
            if (count === 0) {
              count = response.data.totalUsers - currentIndex;
            }
            
            counts[letter] = count;
          } else {
            counts[letter] = 0;
          }
        });
        
        setLetterCounts(counts);
      }
      
      setTotalUsers(response.data.totalUsers);
      setLoading(false);
      
      // Find the first letter with data
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of alphabet) {
        if (response.data.alphabetIndex[letter] !== undefined) {
          setCurrentLetter(letter);
          break;
        }
      }
      
    } catch (err) {
      if (err.response && err.response.status === 503) {
        setLoadingStatus('Server is still initializing the cache. Retrying in 3 seconds...');
        setTimeout(fetchAlphabetData, 3000);
        return;
      }
      
      console.error('Error fetching alphabet index:', err);
      setError('Failed to load navigation data. Please try again later.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlphabetData();
  }, [fetchAlphabetData]);

  // Fetch users for a specific letter (only when needed)
  const fetchUsersForLetter = useCallback(async (letter, startIndex, endIndex) => {
    if (!letter || alphabetIndex[letter] === undefined) return;
    
    const letterStartIndex = alphabetIndex[letter];
    const globalStartIndex = letterStartIndex + startIndex;
    const globalEndIndex = letterStartIndex + endIndex;
    
    const cacheKey = `${letter}-${startIndex}-${endIndex}`;
    
    if (requestCacheRef.current.has(cacheKey)) {
      return;
    }
    
    requestCacheRef.current.add(cacheKey);
    
    try {
      console.log(`Requesting ${letter} users from ${startIndex} to ${endIndex} (global: ${globalStartIndex}-${globalEndIndex})`);
      const response = await axios.get(`${API_URL}/users?start=${globalStartIndex}&limit=${endIndex - startIndex + 1}`);
      
      setUsersByLetter(prev => {
        // Initialize letter container if needed
        if (!prev[letter]) {
          prev[letter] = {};
        }
        
        const newLetterUsers = { ...prev[letter] };
        response.data.users.forEach((user, index) => {
          newLetterUsers[startIndex + index] = user;
        });
        
        return {
          ...prev,
          [letter]: newLetterUsers
        };
      });
    } catch (err) {
      console.error(`Error fetching users for ${letter}:`, err);
    } finally {
      requestCacheRef.current.delete(cacheKey);
    }
  }, [alphabetIndex]);

  // Debounced load function that cancels previous requests
  const debouncedLoadItems = useCallback((startIndex, stopIndex) => {
    if (!currentLetter || alphabetIndex[currentLetter] === undefined) return Promise.resolve();
    
    // Store the latest request parameters
    pendingRequestRef.current = { startIndex, stopIndex };
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Return a promise that resolves when the actual request is made
    return new Promise(resolve => {
      debounceTimerRef.current = setTimeout(() => {
        // Only process the most recent request
        const { startIndex, stopIndex } = pendingRequestRef.current;
        fetchUsersForLetter(currentLetter, startIndex, stopIndex).then(resolve);
      }, DEBOUNCE_TIME);
    });
  }, [currentLetter, fetchUsersForLetter, alphabetIndex]);

  // Check if item is loaded for current letter
  const isItemLoaded = useCallback(index => {
    if (!currentLetter || !usersByLetter[currentLetter]) return false;
    return !!usersByLetter[currentLetter][index];
  }, [currentLetter, usersByLetter]);

  // Handle scroll to update position indicator
  const handleScroll = useCallback(({ scrollOffset }) => {
    const approxIndex = Math.floor(scrollOffset / 40);
    setCurrentPosition(approxIndex);
  }, []);

  // Navigate to a letter
  const navigateToLetter = useCallback((letter) => {
    if (alphabetIndex[letter] !== undefined) {
      setCurrentLetter(letter);
      setCurrentPosition(0);
      
      // Reset scroll position when switching letters
      if (listRef.current) {
        listRef.current.scrollTo(0);
      }
      
      // Pre-fetch initial data for this letter
      fetchUsersForLetter(letter, 0, BATCH_SIZE);
    }
  }, [alphabetIndex, fetchUsersForLetter]);

  // Generate alphabet navigation
  const renderAlphabetNav = useCallback(() => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    return (
      <div className="alphabet-nav">
        {alphabet.map(letter => {
          // Calculate if the letter has data
          const hasData = alphabetIndex[letter] !== undefined && 
                          (letterCounts[letter] !== undefined && letterCounts[letter] > 0);
          
          return (
            <button
              key={letter}
              onClick={() => navigateToLetter(letter)}
              className={letter === currentLetter ? 'active' : ''}
              disabled={!hasData}
            >
              {letter}
              {hasData && (
                <small className="letter-count">{letterCounts[letter] || 0}</small>
              )}
            </button>
          );
        })}
      </div>
    );
  }, [alphabetIndex, currentLetter, letterCounts, navigateToLetter]);

  // Render a row in the virtualized list
  const Row = useCallback(({ index, style }) => {
    if (!currentLetter || !usersByLetter[currentLetter]) {
      return <div style={style} className="loading-row">Select a letter</div>;
    }
    
    const user = usersByLetter[currentLetter][index];
    
    return (
      <div style={style} className="user-row">
        {user ? (
          <div>{user}</div>
        ) : (
          <div className="loading-row">Loading...</div>
        )}
      </div>
    );
  }, [currentLetter, usersByLetter]);
  
  if (loading) {
    return <div className="loading">{loadingStatus}</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  // Get current letter count
  const currentLetterCount = currentLetter && letterCounts[currentLetter] 
    ? letterCounts[currentLetter] 
    : 0;

  return (
    <div className="app">
      <header>
        <h1>User Name Directory</h1>
        <p>Efficiently displaying {totalUsers.toLocaleString()} user names</p>
      </header>
      
      {renderAlphabetNav()}
      
      <div className="current-selection">
        {currentLetter ? (
          <h2>
            Showing names starting with "{currentLetter}" 
            <span className="letter-total">({letterCounts[currentLetter] || 0} names)</span>
          </h2>
        ) : (
          <h2>Select a letter to view names</h2>
        )}
      </div>
      
      {currentLetter && (
        <div className="position-indicator">
          Position: {currentPosition.toLocaleString()} of {currentLetterCount.toLocaleString()}
        </div>
      )}
      
      <div className="list-container">
        {currentLetter && currentLetterCount > 0 ? (
          <InfiniteLoader
            ref={infiniteLoaderRef}
            isItemLoaded={isItemLoaded}
            itemCount={currentLetterCount}
            loadMoreItems={debouncedLoadItems}
            threshold={500}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(listInstance) => {
                  ref(listInstance);
                  listRef.current = listInstance;
                }}
                height={600}
                width="100%"
                itemCount={currentLetterCount}
                itemSize={40}
                onItemsRendered={onItemsRendered}
                onScroll={handleScroll}
              >
                {Row}
              </List>
            )}
          </InfiniteLoader>
        ) : (
          <div className="empty-message">
            {currentLetter ? 
              `No names starting with "${currentLetter}" found.` : 
              "Please select a letter to view names."}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;